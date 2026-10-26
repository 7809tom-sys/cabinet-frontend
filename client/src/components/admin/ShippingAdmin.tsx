import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Truck, Plug, ShieldCheck, Activity, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, PackageSearch, Search } from "lucide-react";
import FreightTestLab from "./FreightTestLab";
import { PelicanCatalogWeightCompare } from "@/components/shipping/ShippingQuoteBox";
import { isValidZipPrefix, normalizeZipPrefix, parseZipPrefixes, serializeZipPrefixes } from "@/lib/shippingZipPrefixes";

// Dollars <-> cents helpers (we edit dollars, store cents).
const toDollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (dollars: string) => Math.round((parseFloat(dollars) || 0) * 100);
const numOr = (s: string, d: number) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : d;
};

type ZoneRow = { zoneName: string; zipPrefixes: string; rateDollars: string };

type HardwareProfileForm = {
  enabled: boolean;
  packageLengthIn: string;
  packageWidthIn: string;
  packageHeightIn: string;
  packageWeightLbs: string;
  standaloneShipping: string;
  sourceReference: string;
};

const nullableNumber = (value: string) => {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
};

function HardwareResourcesShippingProfile() {
  const utils = trpc.useUtils();
  const profileQuery = trpc.hardware.adminGetShippingProfile.useQuery();
  const [form, setForm] = useState<HardwareProfileForm | null>(null);
  useEffect(() => {
    if (!profileQuery.data || form) return;
    const profile = profileQuery.data.profile;
    setForm({
      enabled: profile?.enabled ?? false,
      packageLengthIn: profile?.packageLengthIn == null ? "" : String(profile.packageLengthIn),
      packageWidthIn: profile?.packageWidthIn == null ? "" : String(profile.packageWidthIn),
      packageHeightIn: profile?.packageHeightIn == null ? "" : String(profile.packageHeightIn),
      packageWeightLbs: profile?.packageWeightLbs == null ? "" : String(profile.packageWeightLbs),
      standaloneShipping: profile?.standaloneShippingCents == null ? "" : toDollars(profile.standaloneShippingCents),
      sourceReference: profile?.sourceReference ?? "",
    });
  }, [profileQuery.data, form]);
  const save = trpc.hardware.adminSaveShippingProfile.useMutation({
    onSuccess: (result) => {
      utils.hardware.adminGetShippingProfile.invalidate();
      toast.success(result.checkoutEnabled ? "Hardware checkout profile enabled" : "Hardware shipment profile saved but remains disabled");
    },
    onError: (error) => toast.error(error.message),
  });
  if (profileQuery.isLoading || !form) return <Card><CardContent className="py-6"><Spinner className="h-5 w-5" /></CardContent></Card>;
  const checkoutEnabled = profileQuery.data?.checkoutEnabled === true;
  const set = (patch: Partial<HardwareProfileForm>) => setForm((current) => current ? { ...current, ...patch } : current);
  return (
    <Card id="hardware-resources-shipping-profile" className="border-sky-300/70">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><PackageSearch className="h-5 w-5 text-primary" /> Hardware Resources: one-package shipping profile</CardTitle>
          <Badge variant={checkoutEnabled ? "default" : "secondary"}>{checkoutEnabled ? "Checkout enabled" : "Checkout disabled"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Decorative hardware follows the existing non-cabinet product flow, but it has one consolidated package regardless of handle count. It never uses cabinet pallets or Pelican countertop settings. The shipment origin comes from the hardware vendor profile; enter one package’s dimensions and weight, stand-alone shipping charge, and source reference before enabling it.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/25 p-3">
          <div><Label htmlFor="hardware-checkout-enabled" className="font-semibold">Enable Hardware Resources checkout</Label><p className="text-xs text-muted-foreground">Disabled keeps hardware browseable but prevents checkout and no rate is invented.</p></div>
          <Switch id="hardware-checkout-enabled" checked={form.enabled} onCheckedChange={(enabled) => set({ enabled })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label>Vendor profile ZIP</Label><Input value={profileQuery.data?.vendorOriginZip ?? "Not configured"} readOnly disabled /><p className="text-xs text-muted-foreground">Edit the vendor’s shipping ZIP in its profile.</p></div>
          <div className="space-y-1"><Label>Package length (in)</Label><Input inputMode="decimal" value={form.packageLengthIn} onChange={(event) => set({ packageLengthIn: event.target.value })} /></div>
          <div className="space-y-1"><Label>Package width (in)</Label><Input inputMode="decimal" value={form.packageWidthIn} onChange={(event) => set({ packageWidthIn: event.target.value })} /></div>
          <div className="space-y-1"><Label>Package height (in)</Label><Input inputMode="decimal" value={form.packageHeightIn} onChange={(event) => set({ packageHeightIn: event.target.value })} /></div>
          <div className="space-y-1"><Label>Package weight (lb)</Label><Input inputMode="decimal" value={form.packageWeightLbs} onChange={(event) => set({ packageWeightLbs: event.target.value })} /></div>
          <div className="space-y-1"><Label>Stand-alone shipping ($)</Label><Input inputMode="decimal" value={form.standaloneShipping} onChange={(event) => set({ standaloneShipping: event.target.value })} /></div>
          <div className="space-y-1"><Label>Source reference</Label><Input value={form.sourceReference} onChange={(event) => set({ sourceReference: event.target.value })} placeholder="Rate sheet / approval date" /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
          <span>Kitchen merchandise in the same order receives the approved free hardware shipping promotion. Hardware price is supplier list by default; an affiliate may add only its separate Hardware markup.</span>
          <Button size="sm" type="button" onClick={() => save.mutate({
            enabled: form.enabled,
            packageLengthIn: nullableNumber(form.packageLengthIn),
            packageWidthIn: nullableNumber(form.packageWidthIn),
            packageHeightIn: nullableNumber(form.packageHeightIn),
            packageWeightLbs: nullableNumber(form.packageWeightLbs),
            standaloneShippingCents: form.standaloneShipping.trim() === "" ? null : toCents(form.standaloneShipping),
            sourceReference: form.sourceReference.trim() || null,
          })} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save hardware profile"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SettingsForm {
  enabled: boolean;
  originZip: string;
  rateModel: "per_cwt" | "flat";
  handlingFee: string;
  minCharge: string;
  liftgateFee: string;
  residentialFee: string;
  insideDeliveryFee: string;
  markupPct: string;
  damageFeePct: string;
  freeFreightThreshold: string;
  defaultCabinetWeightLbs: string;
  // Live-quote model
  quoteMode: "estimator" | "live";
  liveProvider: "estimator" | "ups" | "easypost" | "shippo" | "freightquote" | "globaltranz" | "worldwideexpress";
  // Direct UPS Rating API credentials
  upsClientId: string;
  upsClientSecret: string;
  upsAccountNumber: string;
  upsEnvironment: "sandbox" | "production";
  // Freightquote credentials
  fqClientId: string;
  fqClientSecret: string;
  fqAccountNumber: string;
  fqEnvironment: "sandbox" | "production";
  // GlobalTranz credentials
  gtzApiKey: string;
  gtzUsername: string;
  gtzPassword: string;
  gtzAccountNumber: string;
  gtzEnvironment: "sandbox" | "production";
  // Worldwide Express credentials
  wwexClientId: string;
  wwexClientSecret: string;
  wwexAccountNumber: string;
  wwexUsername: string;
  wwexPassword: string;
  wwexEnvironment: "sandbox" | "production";
  wwexSandboxTokenUrl: string;
  wwexSandboxRateUrl: string;
  wwexProductionTokenUrl: string;
  wwexProductionRateUrl: string;
  standardPalletLengthIn: string;
  palletLengthIn: string;
  palletWidthIn: string;
  palletHeightIn: string;
  palletMaxWeightLbs: string;
  palletMaxCubicFt: string;
  palletTareLbs: string;
  freightClass: string;
  defaultCabinetCubicFt: string;
}

export default function ShippingAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.freight.adminGet.useQuery();

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState(""); // write-only
  const [hasKey, setHasKey] = useState(false);
  const [hasUpsClientSecret, setHasUpsClientSecret] = useState(false);
  const [hasWwexClientSecret, setHasWwexClientSecret] = useState(false);
  const [zipDrafts, setZipDrafts] = useState<Record<number, string>>({});
  const [formInitialized, setFormInitialized] = useState(false);

  useEffect(() => {
    // Settings queries may finish after a credential mutation. Initialise once
    // only, so an earlier cached response can never put an old Client ID back.
    if (!data || formInitialized) return;
    const s = data.settings as
      | (NonNullable<typeof data.settings> & { hasLiveApiKey?: boolean; hasUpsClientSecret?: boolean; hasWwexClientSecret?: boolean })
      | null;
    setHasKey(!!s?.hasLiveApiKey);
    setHasUpsClientSecret(!!s?.hasUpsClientSecret);
    setHasWwexClientSecret(!!s?.hasWwexClientSecret);
    setForm({
      enabled: s?.enabled ?? true,
      originZip: s?.originZip ?? "",
      rateModel: (s?.rateModel ?? "per_cwt") as "per_cwt" | "flat",
      handlingFee: toDollars(s?.handlingFeeCents ?? 0),
      minCharge: toDollars(s?.minChargeCents ?? 8900),
      liftgateFee: toDollars(s?.liftgateFeeCents ?? 7500),
      residentialFee: toDollars(s?.residentialFeeCents ?? 6500),
      insideDeliveryFee: toDollars(s?.insideDeliveryFeeCents ?? 5000),
      markupPct: ((s?.markupBps ?? 1500) / 100).toString(),
      damageFeePct: ((s?.damageFeeBps ?? 0) / 100).toString(),
      freeFreightThreshold: toDollars(s?.freeFreightThresholdCents ?? 0),
      defaultCabinetWeightLbs: String(s?.defaultCabinetWeightLbs ?? "45"),
      quoteMode: (s?.quoteMode ?? "estimator") as "estimator" | "live",
      liveProvider: (s?.liveProvider ?? "estimator") as SettingsForm["liveProvider"],
      upsClientId: (s as Record<string, unknown>)?.upsClientId as string ?? "",
      upsClientSecret: "",
      upsAccountNumber: (s as Record<string, unknown>)?.upsAccountNumber as string ?? "",
      upsEnvironment: ((s as Record<string, unknown>)?.upsEnvironment as "sandbox" | "production") ?? "sandbox",
      fqClientId: (s as Record<string, unknown>)?.fqClientId as string ?? "",
      fqClientSecret: "",
      fqAccountNumber: (s as Record<string, unknown>)?.fqAccountNumber as string ?? "",
      fqEnvironment: ((s as Record<string, unknown>)?.fqEnvironment as "sandbox" | "production") ?? "sandbox",
      gtzApiKey: "",
      gtzUsername: (s as Record<string, unknown>)?.gtzUsername as string ?? "",
      gtzPassword: "",
      gtzAccountNumber: (s as Record<string, unknown>)?.gtzAccountNumber as string ?? "",
      gtzEnvironment: ((s as Record<string, unknown>)?.gtzEnvironment as "sandbox" | "production") ?? "sandbox",
      wwexClientId: (s as Record<string, unknown>)?.wwexClientId as string ?? "",
      wwexClientSecret: "",
      wwexAccountNumber: (s as Record<string, unknown>)?.wwexAccountNumber as string ?? "",
      wwexUsername: (s as Record<string, unknown>)?.wwexUsername as string ?? "",
      wwexPassword: "",
      wwexEnvironment: ((s as Record<string, unknown>)?.wwexEnvironment as "sandbox" | "production") ?? "sandbox",
      wwexSandboxTokenUrl: (s as Record<string, unknown>)?.wwexSandboxTokenUrl as string ?? "",
      wwexSandboxRateUrl: (s as Record<string, unknown>)?.wwexSandboxRateUrl as string ?? "",
      wwexProductionTokenUrl: (s as Record<string, unknown>)?.wwexProductionTokenUrl as string ?? "",
      wwexProductionRateUrl: (s as Record<string, unknown>)?.wwexProductionRateUrl as string ?? "",
      standardPalletLengthIn: String(s?.standardPalletLengthIn ?? "48"),
      palletLengthIn: String(s?.palletLengthIn ?? "96"),
      palletWidthIn: String(s?.palletWidthIn ?? "40"),
      palletHeightIn: String(s?.palletHeightIn ?? "60"),
      palletMaxWeightLbs: String(s?.palletMaxWeightLbs ?? "1200"),
      palletMaxCubicFt: String(s?.palletMaxCubicFt ?? "100"),
      palletTareLbs: String(s?.palletTareLbs ?? "50"),
      freightClass: String(s?.freightClass ?? "175"),
      defaultCabinetCubicFt: String(s?.defaultCabinetCubicFt ?? "8"),
    });
    setZones(
      (data.zones ?? []).map((z) => ({
        zoneName: z.zoneName,
        zipPrefixes: z.zipPrefixes,
        rateDollars: toDollars(z.rateCents),
      }))
    );
    setFormInitialized(true);
  }, [data, formInitialized]);

  const saveSettings = trpc.freight.adminUpdateSettings.useMutation({
    onSuccess: () => {
      utils.freight.adminGet.invalidate();
      setApiKeyInput("");
      toast.success("Shipping settings saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveZones = trpc.freight.adminSaveZones.useMutation({
    onSuccess: () => {
      utils.freight.adminGet.invalidate();
      toast.success("Freight zones saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveWwexCredentials = trpc.freight.saveWwexCredentials.useMutation({
    onSuccess: (result) => {
      setHasWwexClientSecret(result.hasWwexClientSecret);
      setForm((current) => current ? { ...current, wwexClientId: result.wwexClientId, wwexClientSecret: "" } : current);
      utils.freight.adminGet.invalidate();
      toast.success("WWEX Client ID and Client Secret saved securely. The secret box clears by design.");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveUpsCredentials = trpc.freight.saveUpsCredentials.useMutation({
    onSuccess: (result) => {
      setHasUpsClientSecret(result.hasUpsClientSecret);
      setForm((current) => current ? {
        ...current,
        upsClientId: result.upsClientId,
        upsAccountNumber: result.upsAccountNumber,
        upsEnvironment: result.upsEnvironment,
        upsClientSecret: "",
      } : current);
      utils.freight.adminGet.invalidate();
      toast.success("UPS Client ID, Client Secret, and linked account number saved.");
    },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">Couldn't load shipping settings: {error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }
  if (!form) return null;

  const set = (patch: Partial<SettingsForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  function handleSaveSettings() {
    if (!form) return;
    saveSettings.mutate({
      enabled: form.enabled,
      originZip: form.originZip.trim(),
      rateModel: form.rateModel,
      handlingFeeCents: toCents(form.handlingFee),
      minChargeCents: toCents(form.minCharge),
      liftgateFeeCents: toCents(form.liftgateFee),
      residentialFeeCents: toCents(form.residentialFee),
      insideDeliveryFeeCents: toCents(form.insideDeliveryFee),
      markupBps: Math.round(numOr(form.markupPct, 0) * 100),
      damageFeeBps: Math.round(numOr(form.damageFeePct, 0) * 100),
      freeFreightThresholdCents: toCents(form.freeFreightThreshold),
      defaultCabinetWeightLbs: numOr(form.defaultCabinetWeightLbs, 45),
      quoteMode: form.quoteMode,
      liveProvider: form.liveProvider,
      // Broker credentials — only sent when non-empty (server keeps existing if omitted)
      fqClientId: form.fqClientId || undefined,
      fqClientSecret: form.fqClientSecret || undefined,
      fqAccountNumber: form.fqAccountNumber || undefined,
      fqEnvironment: form.fqEnvironment,
      gtzApiKey: form.gtzApiKey || undefined,
      gtzUsername: form.gtzUsername || undefined,
      gtzPassword: form.gtzPassword || undefined,
      gtzAccountNumber: form.gtzAccountNumber || undefined,
      gtzEnvironment: form.gtzEnvironment,
      wwexAccountNumber: form.wwexAccountNumber || undefined,
      wwexUsername: form.wwexUsername || undefined,
      wwexPassword: form.wwexPassword || undefined,
      wwexEnvironment: form.wwexEnvironment,
      wwexSandboxTokenUrl: form.wwexSandboxTokenUrl.trim() || null,
      wwexSandboxRateUrl: form.wwexSandboxRateUrl.trim() || null,
      wwexProductionTokenUrl: form.wwexProductionTokenUrl.trim() || null,
      wwexProductionRateUrl: form.wwexProductionRateUrl.trim() || null,
      liveApiKey: apiKeyInput.trim().length > 0 ? apiKeyInput.trim() : undefined,
      standardPalletLengthIn: numOr(form.standardPalletLengthIn, 48),
      palletLengthIn: numOr(form.palletLengthIn, 96),
      palletWidthIn: numOr(form.palletWidthIn, 40),
      palletHeightIn: numOr(form.palletHeightIn, 60),
      palletMaxWeightLbs: numOr(form.palletMaxWeightLbs, 1200),
      palletMaxCubicFt: numOr(form.palletMaxCubicFt, 100),
      palletTareLbs: numOr(form.palletTareLbs, 50),
      freightClass: form.freightClass.trim() || "175",
      defaultCabinetCubicFt: numOr(form.defaultCabinetCubicFt, 8),
    });
  }

  function handleSaveZones() {
    persistZones(zones, "Freight zones saved");
  }

  function persistZones(nextZones: ZoneRow[], successMessage: string) {
    const cleaned = nextZones
      .map((z) => ({
        zoneName: z.zoneName.trim(),
        zipPrefixes: serializeZipPrefixes(parseZipPrefixes(z.zipPrefixes)),
        rateCents: toCents(z.rateDollars),
      }))
      .filter((z) => z.zoneName && z.zipPrefixes);
    saveZones.mutate({ zones: cleaned }, {
      onSuccess: () => {
        setZones(nextZones);
        utils.freight.adminGet.invalidate();
        toast.success(successMessage);
      },
    });
  }

  function updateZone(index: number, patch: Partial<ZoneRow>) {
    setZones((current) => current.map((zone, zoneIndex) => (zoneIndex === index ? { ...zone, ...patch } : zone)));
  }

  function addZipToZone(index: number) {
    const rawDraft = zipDrafts[index] ?? "";
    const zip = normalizeZipPrefix(rawDraft);
    if (!isValidZipPrefix(zip)) {
      toast.error("Enter a ZIP code or ZIP prefix using 1 to 5 digits.");
      return;
    }
    const currentZips = parseZipPrefixes(zones[index]?.zipPrefixes ?? "");
    if (currentZips.includes(zip)) {
      toast.error(`${zip} is already in this zone.`);
      return;
    }
    const nextZones = zones.map((zone, zoneIndex) => (
      zoneIndex === index
        ? { ...zone, zipPrefixes: serializeZipPrefixes([...currentZips, zip]) }
        : zone
    ));
    persistZones(nextZones, `${zip} added and saved.`);
    setZipDrafts((current) => ({ ...current, [index]: "" }));
  }

  function removeZipFromZone(index: number, zip: string) {
    const nextZones = zones.map((zone, zoneIndex) => (
      zoneIndex === index
        ? { ...zone, zipPrefixes: serializeZipPrefixes(parseZipPrefixes(zone.zipPrefixes).filter((currentZip) => currentZip !== zip)) }
        : zone
    ));
    persistZones(nextZones, `${zip} removed and saved.`);
  }

  function handleSaveWwexCredentials() {
    if (!form) return;
    const wwexClientId = form.wwexClientId.trim();
    const wwexClientSecret = form.wwexClientSecret.trim();
    if (!wwexClientId || !wwexClientSecret) {
      toast.error("Enter both the WWEX Client ID and Client Secret before saving.");
      return;
    }
    saveWwexCredentials.mutate({ wwexClientId, wwexClientSecret });
  }

  function handleSaveUpsCredentials() {
    if (!form) return;
    const upsClientId = form.upsClientId.trim();
    const upsClientSecret = form.upsClientSecret.trim();
    const upsAccountNumber = form.upsAccountNumber.trim().toUpperCase();
    if (!upsClientId || !upsClientSecret || !upsAccountNumber) {
      toast.error("Enter the UPS Client ID, Client Secret, and linked account number before saving.");
      return;
    }
    saveUpsCredentials.mutate({ upsClientId, upsClientSecret, upsAccountNumber, upsEnvironment: form.upsEnvironment });
  }

  const liveMode = form.quoteMode === "live";

  return (
    <div className="space-y-6">
      <HardwareResourcesShippingProfile />
      {/* ── Shipping mode + live provider ─────────────────────────────── */}
      <Card id="shipping-live-provider">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" /> Shipping Mode
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose how shipping is priced. <strong>Live quote</strong> calls a carrier API for a real
            parcel or LTL rate (no estimates). EasyPost evaluates verified cartons for UPS, FedEx, and USPS before using LTL pallets. Until a key is connected, the storefront shows
            "shipping quoted on your order" rather than a guessed amount.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quote mode</Label>
              <Select value={form.quoteMode} onValueChange={(v) => set({ quoteMode: v as "estimator" | "live" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live carrier quote (recommended)</SelectItem>
                  <SelectItem value="estimator">In-house estimator (legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Live provider</Label>
              <Select
                value={form.liveProvider}
                onValueChange={(v) => set({ liveProvider: v as SettingsForm["liveProvider"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ups">UPS Rating API (direct parcel)</SelectItem>
                  <SelectItem value="easypost">EasyPost (UPS/FedEx/USPS parcel + LTL)</SelectItem>
                  <SelectItem value="freightquote">Freightquote by C.H. Robinson</SelectItem>
                  <SelectItem value="globaltranz">GlobalTranz</SelectItem>
                  <SelectItem value="worldwideexpress">Worldwide Express (WWEX)</SelectItem>
                  <SelectItem value="shippo">Shippo</SelectItem>
                  <SelectItem value="estimator">None (estimator only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Carrier API key
              {hasKey && (
                <span className="text-xs font-normal text-emerald-600">• key on file</span>
              )}
            </Label>
            <Input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasKey ? "•••••••• (leave blank to keep current key)" : "Paste your EasyPost API key (EZTK… test or EZAK… live)"}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Stored securely server-side and never displayed back. Use your <strong>test key</strong>{" "}
              first to verify, then switch to the live key. Parcel rates use only verified carton dimensions and packaged weight; missing or oversized cartons remain on the LTL path.
            </p>
          </div>

          {liveMode && form.liveProvider === "easypost" && !hasKey && apiKeyInput.trim().length === 0 && (
            <p className="text-sm text-amber-600">
              Live mode is on but no API key is connected yet — the storefront will show
              "shipping quoted on your order" until you save a key.
            </p>
          )}

          {/* ── Direct UPS Rating API credentials ─────────────────────────── */}
          {liveMode && form.liveProvider === "ups" && (
            <div id="ups-direct-settings" className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">UPS Rating API — Direct Parcel Credentials</p>
              <p className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
                <strong>Exact-carton rule:</strong> Direct UPS is used only when every item has verified packaged length, width, height, and weight and fits the UPS parcel screen. Larger, mixed, or incomplete-carton orders remain visibly unavailable for this provider rather than being converted to an estimate or a made-up UPS package.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">UPS Developer Client ID</Label>
                  <Input name="ups-client-id" value={form.upsClientId} onChange={(e) => set({ upsClientId: e.target.value })} placeholder="Client ID from developer.ups.com" autoComplete="off" autoCapitalize="none" spellCheck={false} data-lpignore="true" data-1p-ignore="true" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">UPS Developer Client Secret</Label>
                  <Input name="ups-client-secret" type="password" value={form.upsClientSecret} onChange={(e) => set({ upsClientSecret: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveUpsCredentials(); } }} placeholder="Enter a replacement secret" autoComplete="new-password" autoCapitalize="none" spellCheck={false} data-lpignore="true" data-1p-ignore="true" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Linked UPS account number</Label>
                  <Input name="ups-account-number" value={form.upsAccountNumber} onChange={(e) => set({ upsAccountNumber: e.target.value.toUpperCase() })} placeholder="e.g. 22V1B8" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Environment</Label>
                  <Select value={form.upsEnvironment} onValueChange={(v) => set({ upsEnvironment: v as "sandbox" | "production" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">UPS CIE sandbox (test)</SelectItem>
                      <SelectItem value="production">UPS production (live rates)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-foreground">Save the UPS Client ID, Client Secret, account number, and environment together.</p>
                  <Button type="button" size="sm" className="shrink-0" onClick={handleSaveUpsCredentials} disabled={saveUpsCredentials.isPending}>
                    {saveUpsCredentials.isPending ? "Saving UPS credentials…" : "Save UPS credentials"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Create or select the <strong>Rating</strong> API product at <a href="https://developer.ups.com" target="_blank" rel="noopener noreferrer" className="underline">developer.ups.com</a>, then save its Client ID and Client Secret here. The secret is write-only and is never displayed again. A rate lookup creates no label, pickup, shipment, payment, or UPS account change.
                {hasUpsClientSecret ? " A UPS Client Secret is already on file; enter a replacement above to change it." : " No UPS Client Secret is saved yet."}
              </p>
            </div>
          )}

          {/* ── Freightquote (C.H. Robinson) credentials ─────────────────── */}
          {liveMode && form.liveProvider === "freightquote" && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Freightquote by C.H. Robinson — OAuth2 Credentials</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Client ID</Label>
                  <Input value={form.fqClientId} onChange={(e) => set({ fqClientId: e.target.value })} placeholder="Client ID from Navisphere portal" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Secret</Label>
                  <Input type="password" value={form.fqClientSecret} onChange={(e) => set({ fqClientSecret: e.target.value })} placeholder="•••••••• (leave blank to keep current)" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Number</Label>
                  <Input value={form.fqAccountNumber} onChange={(e) => set({ fqAccountNumber: e.target.value })} placeholder="C.H. Robinson account number" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Environment</Label>
                  <Select value={form.fqEnvironment} onValueChange={(v) => set({ fqEnvironment: v as "sandbox" | "production" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (test)</SelectItem>
                      <SelectItem value="production">Production (live)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Get credentials at <a href="https://developer.chrobinson.com" target="_blank" rel="noopener noreferrer" className="underline">developer.chrobinson.com</a>. Requires an active C.H. Robinson shipper account.</p>
            </div>
          )}

          {/* ── GlobalTranz credentials ───────────────────────────────────── */}
          {liveMode && form.liveProvider === "globaltranz" && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GlobalTranz — API Key + Basic Auth</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">API / Security Key</Label>
                  <Input type="password" value={form.gtzApiKey} onChange={(e) => set({ gtzApiKey: e.target.value })} placeholder="•••••••• (leave blank to keep current)" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Number</Label>
                  <Input value={form.gtzAccountNumber} onChange={(e) => set({ gtzAccountNumber: e.target.value })} placeholder="GTZconnect customer ID" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Username</Label>
                  <Input value={form.gtzUsername} onChange={(e) => set({ gtzUsername: e.target.value })} placeholder="GTZconnect username" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input type="password" value={form.gtzPassword} onChange={(e) => set({ gtzPassword: e.target.value })} placeholder="•••••••• (leave blank to keep current)" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Environment</Label>
                  <Select value={form.gtzEnvironment} onValueChange={(v) => set({ gtzEnvironment: v as "sandbox" | "production" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (test)</SelectItem>
                      <SelectItem value="production">Production (live)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Contact GlobalTranz at <a href="mailto:apisupport@globaltranz.com" className="underline">apisupport@globaltranz.com</a> to obtain API credentials.</p>
            </div>
          )}

          {/* ── Worldwide Express credentials ─────────────────────────────── */}
          {liveMode && form.liveProvider === "worldwideexpress" && (
            <div id="worldwide-express-settings" className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Worldwide Express (WWEX) — OAuth2 Credentials</p>
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>Parcel program:</strong> SpeedShip supports WWEX/UPS parcel services, but these saved fields currently authorize the verified LTL shopFlow route only. Do not point carton parcels at the LTL rate URL. Enable WWEX parcel rating only after your WWEX representative supplies the account-authorized parcel endpoint, request/response schema, and the correct sandbox or production scope.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Client ID</Label>
                  <Input name="wwex-client-id" value={form.wwexClientId} onChange={(e) => set({ wwexClientId: e.target.value })} placeholder="WWEX Client ID" autoComplete="off" autoCapitalize="none" spellCheck={false} data-lpignore="true" data-1p-ignore="true" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Secret</Label>
                  <Input name="wwex-client-secret" type="password" value={form.wwexClientSecret} onChange={(e) => set({ wwexClientSecret: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveWwexCredentials(); } }} placeholder="Enter a replacement secret" autoComplete="new-password" autoCapitalize="none" spellCheck={false} data-lpignore="true" data-1p-ignore="true" />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-foreground">
                    Save these two fields together before editing any optional WWEX settings.
                  </p>
                  <Button type="button" size="sm" className="shrink-0" onClick={handleSaveWwexCredentials} disabled={saveWwexCredentials.isPending}>
                    {saveWwexCredentials.isPending ? "Saving credentials…" : "Save Client ID + Secret"}
                  </Button>
                </div>
                <div
                  className={`md:col-span-2 flex items-start gap-2 rounded-md border p-3 text-xs ${hasWwexClientSecret && form.wwexClientId.trim()
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
                    : "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"}`}
                  role="status"
                  aria-live="polite"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {hasWwexClientSecret && form.wwexClientId.trim() ? (
                    <span><strong>Securely saved:</strong> the WWEX Client ID and Client Secret are on file. The Client Secret input remains blank after saving or reloading because it is write-only; a blank secret box does <strong>not</strong> mean the secret was removed.</span>
                  ) : (
                    <span><strong>Credentials need saving:</strong> enter both the WWEX Client ID and Client Secret, then use <strong>Save Client ID + Secret</strong>. The main Shipping save button does not save this protected pair.</span>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Number</Label>
                  <Input value={form.wwexAccountNumber} onChange={(e) => set({ wwexAccountNumber: e.target.value })} placeholder="WWEX account number" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Username (legacy)</Label>
                  <Input value={form.wwexUsername} onChange={(e) => set({ wwexUsername: e.target.value })} placeholder="SpeedShip username (optional)" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password (legacy)</Label>
                  <Input type="password" value={form.wwexPassword} onChange={(e) => set({ wwexPassword: e.target.value })} placeholder="•••••••• (leave blank to keep current)" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Environment</Label>
                  <Select value={form.wwexEnvironment} onValueChange={(v) => set({ wwexEnvironment: v as "sandbox" | "production" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (test)</SelectItem>
                      <SelectItem value="production">Production (live)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">
                    {form.wwexEnvironment === "sandbox" ? "Sandbox" : "Production"} OAuth token URL
                  </Label>
                  <Input
                    inputMode="url"
                    value={form.wwexEnvironment === "sandbox" ? form.wwexSandboxTokenUrl : form.wwexProductionTokenUrl}
                    onChange={(e) => set(form.wwexEnvironment === "sandbox"
                      ? { wwexSandboxTokenUrl: e.target.value }
                      : { wwexProductionTokenUrl: e.target.value })}
                    placeholder="Verified HTTPS token URL from your WWEX representative"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">
                    {form.wwexEnvironment === "sandbox" ? "Sandbox" : "Production"} rate URL
                  </Label>
                  <Input
                    inputMode="url"
                    value={form.wwexEnvironment === "sandbox" ? form.wwexSandboxRateUrl : form.wwexProductionRateUrl}
                    onChange={(e) => set(form.wwexEnvironment === "sandbox"
                      ? { wwexSandboxRateUrl: e.target.value }
                      : { wwexProductionRateUrl: e.target.value })}
                    placeholder="Verified HTTPS rate URL from your WWEX representative"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  {hasWwexClientSecret
                    ? "A WWEX Client Secret is on file. Enter a replacement above, then save both client credentials together."
                    : "Enter both client credentials, then save them here before moving on."}
                  {" "}After saving, the secret field clears by design; it does not restore or display a prior secret.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Contact your WWEX account representative for the environment-specific token and rate URLs. The app will not send credentials to guessed or non-HTTPS hosts.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Origin, pallet, floor, class ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Freight Basis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cabinets ship flat-pack (RTA) on freight pallets. Live quotes use each order's
            <strong> packaged weight, cube, and longest package dimension</strong>. Trim rides on the same complete-kitchen shipment without creating a separate pallet; the reported pallet length still covers every loaded item.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Origin ZIP (ship-from)</Label>
              <Input value={form.originZip} onChange={(e) => set({ originZip: e.target.value })} placeholder="30303" />
            </div>
            <div className="space-y-1.5">
              <Label>Freight class</Label>
              <Input value={form.freightClass} onChange={(e) => set({ freightClass: e.target.value })} placeholder="175" />
            </div>
            <div className="space-y-1.5">
              <Label>Operations freight markup %</Label>
              <Input value={form.markupPct} onChange={(e) => set({ markupPct: e.target.value })} placeholder="15" />
              <p className="text-xs text-muted-foreground">
                Applied after the live Plan A carrier rate or an approved style Plan B fee. Delivery accessorials remain itemized.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Pallet definitions</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Standard length (in)</Label>
                <Input value={form.standardPalletLengthIn} onChange={(e) => set({ standardPalletLengthIn: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Long-item length (in)</Label>
                <Input value={form.palletLengthIn} onChange={(e) => set({ palletLengthIn: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Width (in)</Label>
                <Input value={form.palletWidthIn} onChange={(e) => set({ palletWidthIn: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Height (in)</Label>
                <Input value={form.palletHeightIn} onChange={(e) => set({ palletHeightIn: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max weight / pallet (lbs)</Label>
                <Input value={form.palletMaxWeightLbs} onChange={(e) => set({ palletMaxWeightLbs: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max cube / pallet (cu ft)</Label>
                <Input value={form.palletMaxCubicFt} onChange={(e) => set({ palletMaxCubicFt: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Pallet tare (lbs)</Label>
                <Input value={form.palletTareLbs} onChange={(e) => set({ palletTareLbs: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Default cabinet packaged weight (lbs)</Label>
              <Input value={form.defaultCabinetWeightLbs} onChange={(e) => set({ defaultCabinetWeightLbs: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Default cabinet packaged cube (cu ft)</Label>
              <Input value={form.defaultCabinetCubicFt} onChange={(e) => set({ defaultCabinetCubicFt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Free freight over ($, 0 = off)</Label>
              <Input value={form.freeFreightThreshold} onChange={(e) => set({ freeFreightThreshold: e.target.value })} />
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? "Saving…" : "Save shipping settings"}
          </Button>
        </CardContent>
      </Card>

      <FreightTestLab />

      <PelicanShippingProfilesPanel />

      {/* ── Legacy estimator zones (only relevant in estimator mode) ──── */}
      <Card className={liveMode ? "opacity-70" : ""}>
        <CardHeader>
          <CardTitle>Estimator Zones (legacy)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Only used when Quote mode is set to <strong>In-house estimator</strong>. Match a
            destination by leading ZIP digits (comma-separated; longest match wins).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Zone name</TableHead>
                <TableHead>ZIP prefixes</TableHead>
                <TableHead className="w-32">Rate ($)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input value={z.zoneName} onChange={(e) => updateZone(i, { zoneName: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <div className="min-w-[280px] space-y-2">
                      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
                        {parseZipPrefixes(z.zipPrefixes).length > 0 ? parseZipPrefixes(z.zipPrefixes).map((zip) => (
                          <span key={zip} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                            {zip}
                            <button type="button" className="rounded-full p-0.5 hover:bg-primary/15" onClick={() => removeZipFromZone(i, zip)} aria-label={`Remove ZIP code ${zip}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )) : <span className="text-xs text-muted-foreground">No ZIP codes added</span>}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={zipDrafts[i] ?? ""}
                          onChange={(e) => setZipDrafts((current) => ({ ...current, [i]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addZipToZone(i); } }}
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={5}
                          aria-label={`Add ZIP code to ${z.zoneName || "freight zone"}`}
                          placeholder="Add ZIP code"
                        />
                        <Button type="button" variant="outline" size="sm" className="shrink-0 bg-background" onClick={() => addZipToZone(i)}>
                          <Plus className="mr-1 h-4 w-4" /> Add ZIP
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input value={z.rateDollars} onChange={(e) => updateZone(i, { rateDollars: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setZones((current) => current.filter((_, zoneIndex) => zoneIndex !== i));
                      setZipDrafts({});
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <p className="text-xs text-muted-foreground">Add one ZIP code at a time. Each successful Add ZIP or remove action saves immediately. Shorter entries remain supported as leading ZIP prefixes; the most specific matching entry still wins.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-background" onClick={() => setZones([...zones, { zoneName: "", zipPrefixes: "", rateDollars: "0.00" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add zone
            </Button>
            <Button size="sm" onClick={handleSaveZones} disabled={saveZones.isPending}>
              {saveZones.isPending ? "Saving…" : "Save zones"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type PelicanShippingProfileRow = {
  productId: number;
  pelicanCode: string;
  name: string;
  category: string;
  profileId: number | null;
  originName: string | null;
  originZip: string | null;
  transportMode: "parcel" | "ltl" | null;
  packageLengthIn: string | number | null;
  packageWidthIn: string | number | null;
  packageHeightIn: string | number | null;
  packageWeightLbs: string | number | null;
  freightClass: string | null;
  evidenceType: "supplier_verified" | "comparable_estimate" | null;
  comparisonRuleId: string | null;
  sourceUrl: string | null;
  sourceReference: string | null;
  verifiedAt: Date | null;
  isEnabled: boolean | null;
};

type PelicanShippingProfileDraft = {
  originName: string;
  originZip: string;
  transportMode: "parcel" | "ltl";
  packageLengthIn: string;
  packageWidthIn: string;
  packageHeightIn: string;
  packageWeightLbs: string;
  freightClass: string;
  evidenceType: "supplier_verified" | "comparable_estimate";
  comparisonRuleId: string;
  sourceUrl: string;
  sourceReference: string;
  verifiedAt: string;
  isEnabled: boolean;
};

function shippingProfileDraft(row: PelicanShippingProfileRow): PelicanShippingProfileDraft {
  const formatDate = row.verifiedAt ? new Date(row.verifiedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return {
    originName: row.originName ?? "",
    originZip: row.originZip ?? "",
    transportMode: row.transportMode ?? "parcel",
    packageLengthIn: row.packageLengthIn == null ? "" : String(row.packageLengthIn),
    packageWidthIn: row.packageWidthIn == null ? "" : String(row.packageWidthIn),
    packageHeightIn: row.packageHeightIn == null ? "" : String(row.packageHeightIn),
    packageWeightLbs: row.packageWeightLbs == null ? "" : String(row.packageWeightLbs),
    freightClass: row.freightClass ?? "",
    evidenceType: row.evidenceType ?? "supplier_verified",
    comparisonRuleId: row.comparisonRuleId ?? "",
    sourceUrl: row.sourceUrl ?? "",
    sourceReference: row.sourceReference ?? "",
    verifiedAt: formatDate,
    isEnabled: row.isEnabled === true,
  };
}

/**
 * Profiles sit beside carrier credentials and the Freight API log so Operations
 * can distinguish supplier carton evidence from an owner-authorized comparable
 * package estimate and reconcile every live shipment rate.
 */
export function PelicanShippingProfilesPanel({ isAdmin = true }: { isAdmin?: boolean } = {}) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PelicanShippingProfileDraft | null>(null);
  const profilesQuery = trpc.pelican.adminShippingProfiles.useQuery({ search: search.trim() || undefined, limit: 200 });
  const profiles = (profilesQuery.data ?? []) as PelicanShippingProfileRow[];
  const selected = profiles.find((row) => row.productId === selectedId) ?? null;
  const saveProfile = trpc.pelican.saveShippingProfile.useMutation({
    onSuccess: () => {
      void utils.pelican.adminShippingProfiles.invalidate();
      toast.success("Pelican shipping profile saved.");
    },
    onError: (error) => toast.error(error.message),
  });
  const applyComparable = trpc.pelican.applyComparableShippingEstimates.useMutation({
    onSuccess: (result) => {
      void utils.pelican.adminShippingProfiles.invalidate();
      toast.success(`Applied ${result.applied} comparison estimates; preserved ${result.skippedVerified} supplier-verified profiles; ${result.needsManualReview} SKUs still need review.`);
    },
    onError: (error) => toast.error(error.message),
  });

  function choose(row: PelicanShippingProfileRow) {
    setSelectedId(row.productId);
    setDraft(shippingProfileDraft(row));
  }

  function save() {
    if (!selected || !draft) return;
    const packageLengthIn = Number(draft.packageLengthIn);
    const packageWidthIn = Number(draft.packageWidthIn);
    const packageHeightIn = Number(draft.packageHeightIn);
    const packageWeightLbs = Number(draft.packageWeightLbs);
    if (![packageLengthIn, packageWidthIn, packageHeightIn, packageWeightLbs].every((value) => Number.isFinite(value) && value > 0)) {
      toast.error("Enter packaged length, width, height, and weight before saving.");
      return;
    }
    saveProfile.mutate({
      productId: selected.productId,
      originName: draft.originName,
      originZip: draft.originZip,
      transportMode: draft.transportMode,
      packageLengthIn,
      packageWidthIn,
      packageHeightIn,
      packageWeightLbs,
      freightClass: draft.freightClass.trim() || null,
      evidenceType: draft.evidenceType,
      comparisonRuleId: draft.evidenceType === "comparable_estimate" ? draft.comparisonRuleId.trim() || null : null,
      sourceUrl: draft.sourceUrl,
      sourceReference: draft.sourceReference,
      verifiedAt: new Date(`${draft.verifiedAt}T12:00:00.000Z`),
      isEnabled: draft.isEnabled,
    });
  }

  return (
    <Card id="pelican-shipping-profiles">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-primary" /> Pelican shipping profiles
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Use <strong>supplier-verified</strong> carton facts whenever available. Owner-authorized <strong>comparison estimates</strong> are clearly tagged in the cart, order review, and Freight API Log; they support a live carrier request but never become Pelican carton facts.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mr-1.5 inline h-4 w-4 align-text-bottom" />
          Product dimensions are not shipping dimensions. Comparison estimates use the published comparable rule and the official Pelican pickup origin; replace them with supplier-verified carton facts as they arrive.
        </div>
        {isAdmin && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <span>Seed all eligible active Pelican SKUs with cited, conservative comparison-package estimates. Existing supplier-verified profiles are never replaced.</span>
          <Button size="sm" variant="outline" className="bg-background" onClick={() => applyComparable.mutate()} disabled={applyComparable.isPending}>
            {applyComparable.isPending ? "Applying…" : "Apply comparison estimates"}
          </Button>
        </div>}
        {isAdmin && <PelicanCatalogWeightCompare />}
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Find Pelican SKU, product name, or category" aria-label="Find Pelican product shipping profile" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <div className="max-h-[32rem] overflow-auto rounded-lg border">
            {profilesQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Spinner className="h-4 w-4" /> Loading Pelican products…</div>
            ) : profiles.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No Pelican catalog products match this search.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Pelican SKU</TableHead><TableHead>Shipping evidence</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
                <TableBody>
                  {profiles.map((row) => {
                    const complete = row.profileId != null && row.isEnabled === true;
                    return <TableRow key={row.productId} className={selectedId === row.productId ? "bg-muted/60" : ""}>
                      <TableCell className="align-top"><div className="font-mono text-xs font-semibold">{row.pelicanCode}</div><div className="mt-0.5 max-w-sm text-xs text-muted-foreground">{row.name}</div><Badge variant="outline" className="mt-1 text-[10px]">{row.category}</Badge></TableCell>
                      <TableCell className="align-top text-xs">{complete ? <span className={`inline-flex items-center gap-1 ${row.evidenceType === "comparable_estimate" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}><CheckCircle2 className="h-3.5 w-3.5" /> {row.evidenceType === "comparable_estimate" ? "Comparable estimate" : "Supplier verified"} · {row.transportMode} · {row.originZip}</span> : row.profileId ? <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Draft only</span> : <span className="text-muted-foreground">No profile</span>}</TableCell>
                      <TableCell className="align-top"><Button size="sm" variant={selectedId === row.productId ? "secondary" : "outline"} onClick={() => choose(row)}>{row.profileId ? "Edit" : "Add"}</Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            {!selected || !draft ? <p className="py-12 text-center text-sm text-muted-foreground">Select a Pelican SKU to add or review its shipping evidence.</p> : <div className="space-y-3">
              <div><div className="font-semibold">{selected.pelicanCode}</div><div className="text-xs text-muted-foreground">{selected.name}</div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">Ship-from name</Label><Input value={draft.originName} onChange={(event) => setDraft({ ...draft, originName: event.target.value })} placeholder="Verified supplier location" /></div>
                <div className="space-y-1"><Label className="text-xs">Ship-from ZIP</Label><Input inputMode="numeric" value={draft.originZip} onChange={(event) => setDraft({ ...draft, originZip: event.target.value })} placeholder="12345" /></div>
                <div className="space-y-1"><Label className="text-xs">Evidence type</Label><Select value={draft.evidenceType} onValueChange={(value) => setDraft({ ...draft, evidenceType: value as PelicanShippingProfileDraft["evidenceType"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="supplier_verified">Supplier verified</SelectItem><SelectItem value="comparable_estimate">Comparable estimate</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Transport mode</Label><Select value={draft.transportMode} onValueChange={(value) => setDraft({ ...draft, transportMode: value as "parcel" | "ltl" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="parcel">Parcel</SelectItem><SelectItem value="ltl">LTL</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Freight class {draft.transportMode === "ltl" ? "(required)" : "(LTL only)"}</Label><Input value={draft.freightClass} disabled={draft.transportMode !== "ltl"} onChange={(event) => setDraft({ ...draft, freightClass: event.target.value })} placeholder="e.g. 175" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[{ key: "packageLengthIn", label: "Package L" }, { key: "packageWidthIn", label: "Package W" }, { key: "packageHeightIn", label: "Package H" }, { key: "packageWeightLbs", label: "Weight lbs" }].map(({ key, label }) => <div className="space-y-1" key={key}><Label className="text-xs">{label}</Label><Input inputMode="decimal" value={draft[key as keyof Pick<PelicanShippingProfileDraft, "packageLengthIn" | "packageWidthIn" | "packageHeightIn" | "packageWeightLbs">]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></div>)}
              </div>
              <div className="space-y-1"><Label className="text-xs">Source URL</Label><Input inputMode="url" value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="Official supplier PDF or portal link" /></div>
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]"><div className="space-y-1"><Label className="text-xs">Source reference</Label><Input value={draft.sourceReference} onChange={(event) => setDraft({ ...draft, sourceReference: event.target.value })} placeholder="Document title, revision, page, or confirmation" /></div><div className="space-y-1"><Label className="text-xs">Evidence date</Label><Input type="date" value={draft.verifiedAt} onChange={(event) => setDraft({ ...draft, verifiedAt: event.target.value })} /></div></div>
              {draft.evidenceType === "comparable_estimate" && <div className="space-y-1"><Label className="text-xs">Comparison rule ID</Label><Input value={draft.comparisonRuleId} onChange={(event) => setDraft({ ...draft, comparisonRuleId: event.target.value })} placeholder="e.g. bathroom-undermount-sink-v1" /></div>}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-background p-3 text-sm"><Switch checked={draft.isEnabled} onCheckedChange={(isEnabled) => setDraft({ ...draft, isEnabled })} />Enable this {draft.evidenceType === "comparable_estimate" ? "comparison estimate" : "supplier-verified SKU"} for carrier rating</label>
              <Button className="w-full" onClick={save} disabled={saveProfile.isPending}>{saveProfile.isPending ? "Saving shipping profile…" : "Save shipping profile"}</Button>
            </div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function packageSummary(packages: Array<{ kind: string; lengthIn: number; widthIn: number; heightIn: number; weightLbs: number }> | undefined | null): string {
  if (!packages || packages.length === 0) return "—";
  return packages
    .map((p, i) => `${p.kind === "pallet" ? "Pallet" : "Carton"} ${i + 1}: ${p.lengthIn}×${p.widthIn}×${p.heightIn} in, ${p.weightLbs} lb`)
    .join("\n");
}

function csvCell(v: unknown): string {
  const t = String(v ?? "");
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function SavedDesignLink({ design }: { design?: { id: number; name: string; url: string } | null }) {
  if (!design) return <span className="text-muted-foreground">No saved design</span>;
  return (
    <a
      href={design.url}
      className="font-medium text-primary underline underline-offset-2 hover:no-underline"
      data-testid={`freight-design-link-${design.id}`}
    >
      {design.name || `Saved design #${design.id}`}
    </a>
  );
}

// ─── Permanent quote history (stored in the database, never pruned) ───────
export function FreightQuoteHistoryPanel() {
  const [broker, setBroker] = useState<string>("");
  const [onlyOk, setOnlyOk] = useState(false);
  const { data: rows, isLoading, refetch } = trpc.freight.adminQuoteHistory.useQuery({
    limit: 300, broker: broker || undefined, onlyOk: onlyOk || undefined,
  });
  const exportCsv = () => {
    const header = ["Date", "Broker", "From", "To", "Pallets", "Units", "Weight lb", "Class", "Accessorials", "Saved design", "Design link", "Result", "Price", "Carrier", "Service", "Error"];
    const lines = (rows ?? []).map((r) => [
      new Date(r.createdAt).toISOString(), r.broker, r.fromZip, r.toZip, r.palletCount,
      packageSummary(r.packages as any).replace(/\n/g, " | "), r.totalWeightLbs, r.freightClass, r.accessorials,
      r.design?.name ?? "No saved design", r.design?.url ?? "",
      r.ok ? "quoted" : "failed", r.ok ? (r.amountCents / 100).toFixed(2) : "", r.carrier, r.service, r.error,
    ].map(csvCell).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `freight-quote-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card data-testid="freight-quote-history">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Freight Quote History (permanent)</span>
          <span className="flex flex-wrap items-center gap-2">
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={broker} onChange={(e) => setBroker(e.target.value)} aria-label="Filter by broker">
              <option value="">All brokers</option>
              <option value="worldwideexpress">Worldwide Express</option>
              <option value="ups">UPS</option>
              <option value="fedex">FedEx</option>
              <option value="freightquote">Freightquote</option>
              <option value="globaltranz">GlobalTranz</option>
              <option value="easypost">EasyPost</option>
            </select>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={onlyOk} onChange={(e) => setOnlyOk(e.target.checked)} /> Quoted only</label>
            <Button variant="outline" size="sm" className="bg-background" onClick={() => refetch()}>Refresh</Button>
            <Button variant="outline" size="sm" className="bg-background" onClick={exportCsv} disabled={!rows?.length}>Export CSV</Button>
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Every quote request is saved with its pallet/carton sizes and weights so you can compare against rates you look up online. When a quote came from an authorized saved plan, its design link is retained here.</p>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!rows || rows.length === 0) && <p className="text-sm text-muted-foreground">No quotes saved yet. History starts with the next quote request.</p>}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Broker</TableHead>
                  <TableHead className="text-xs">Route</TableHead>
                  <TableHead className="text-xs">Pallets / cartons (L×W×H, lb)</TableHead>
                  <TableHead className="text-xs">Weight</TableHead>
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs">Extras</TableHead>
                  <TableHead className="text-xs">Saved design</TableHead>
                  <TableHead className="text-xs">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-xs font-mono">{r.broker}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.fromZip} → {r.toZip}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-pre-line">{packageSummary(r.packages as any)}</TableCell>
                    <TableCell className="text-xs">{r.totalWeightLbs.toFixed(0)} lb</TableCell>
                    <TableCell className="text-xs">{r.freightClass ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.accessorials || "—"}</TableCell>
                    <TableCell className="max-w-52 text-xs"><SavedDesignLink design={r.design} /></TableCell>
                    <TableCell className="text-xs">
                      {r.ok
                        ? <span className="text-emerald-600 font-medium">${(r.amountCents / 100).toFixed(2)} {r.carrier}{r.service ? ` · ${r.service}` : ""}</span>
                        : <span className="text-destructive" title={r.error ?? ""}>✗ {(r.error ?? "error").slice(0, 60)}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── API Logs sub-component ───────────────────────────────────────────────────
// Exported separately so it can be used standalone or embedded in ShippingAdmin.
export function FreightApiLogsPanel() {
  const { data: logs, isLoading, refetch } = trpc.freight.adminGetApiLogs.useQuery({ limit: 50 });
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(() => new Set());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Freight API Call Log
          </span>
          <Button variant="outline" size="sm" className="bg-background" onClick={() => refetch()}>Refresh</Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Last 50 live carrier API calls. Resets on server restart. Expand any quote to verify every pallet/carton size, weight, and why an eight-foot pallet was used.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!logs || logs.length === 0) && (
          <p className="text-sm text-muted-foreground">No API calls logged yet. Switch to Live mode and request a freight quote to see entries here.</p>
        )}
        {logs && logs.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Broker</TableHead>
                  <TableHead className="text-xs">Route</TableHead>
                  <TableHead className="text-xs">Pallets / cartons (L×W×H, lb)</TableHead>
                  <TableHead className="text-xs">Weight</TableHead>
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs">Accessorials</TableHead>
                  <TableHead className="text-xs">Packages</TableHead>
                  <TableHead className="text-xs">Saved design</TableHead>
                  <TableHead className="text-xs">Result</TableHead>
                  <TableHead className="text-xs">ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const expanded = expandedLogIds.has(log.id);
                  return <>
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(log.ts).toLocaleTimeString()}</TableCell>
                    <TableCell className="text-xs font-mono">{log.broker}</TableCell>
                    <TableCell className="text-xs font-mono">{log.fromZip} → {log.toZip}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-pre-line">{packageSummary(log.packages)}</TableCell>
                    <TableCell className="text-xs">{log.totalWeightLbs.toFixed(0)} lbs</TableCell>
                    <TableCell className="text-xs">{log.freightClass}</TableCell>
                    <TableCell className="text-xs">{log.accessorials.join(", ") || "—"}</TableCell>
                    <TableCell className="text-xs">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} package details for quote ${log.id}`}
                        onClick={() => setExpandedLogIds((current) => {
                          const next = new Set(current);
                          if (next.has(log.id)) next.delete(log.id); else next.add(log.id);
                          return next;
                        })}
                      >
                        {log.packages?.length ?? 0} {log.packages?.length === 1 ? "unit" : "units"}
                        {expanded ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                    <TableCell className="max-w-52 text-xs"><SavedDesignLink design={log.design} /></TableCell>
                    <TableCell className="text-xs">
                      {log.ok ? (
                        <span className="text-emerald-600 font-medium">${(log.amountCents / 100).toFixed(2)} {log.carrier}</span>
                      ) : (
                        <span className="text-destructive" title={log.error}>✗ {(log.error ?? "error").slice(0, 40)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.durationMs}</TableCell>
                  </TableRow>
                  {expanded && <TableRow key={`${log.id}-packages`}>
                    <TableCell colSpan={11} className="bg-muted/30 p-3">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold">Exact handling units sent or prepared for this quote</p>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {(log.packages ?? []).map((pkg) => (
                            <div key={`${log.id}-${pkg.kind}-${pkg.index}`} className="rounded-md border bg-background p-2 text-xs">
                              <div className="font-medium">{pkg.kind === "pallet" ? "Pallet" : "Carton"} {pkg.index}{pkg.label ? ` · ${pkg.label}` : ""}</div>
                              <div className="mt-1 font-mono">{pkg.lengthIn}″ L × {pkg.widthIn}″ W × {pkg.heightIn}″ H · {pkg.weightLbs} lb</div>
                              {pkg.contentsWeightLbs != null && <div className="text-muted-foreground">Contents: {pkg.contentsWeightLbs} lb{pkg.contentsCubicFt != null ? ` · ${pkg.contentsCubicFt} ft³` : ""}</div>}
                              {pkg.reason && <div className="mt-1 text-muted-foreground">{pkg.reason}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>}
                </>;
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
