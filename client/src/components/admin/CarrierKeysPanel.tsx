import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { KeyRound, CheckCircle2, XCircle } from "lucide-react";

type Env = "sandbox" | "production";
type CarrierForm = { id: string; secret: string; account: string; env: Env };
const empty: CarrierForm = { id: "", secret: "", account: "", env: "sandbox" };

type BlockOptions = {
  carrier: "ups" | "fedex";
  title: string;
  idLabel: string;
  secretLabel: string;
  accountLabel: string;
  portal: string;
  form: CarrierForm;
  setForm: (f: CarrierForm) => void;
  has: boolean;
  saving: boolean;
  onSave: () => void;
  status?: { ok: boolean; text: string };
  testing: boolean;
  onTest: () => void;
};

function CarrierBlock(o: BlockOptions) {
  const { carrier, form, setForm, has, status } = o;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3" data-testid={`carrier-keys-${carrier}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{o.title}</p>
        <span className={`text-xs ${has ? "text-green-700" : "text-muted-foreground"}`}>
          {has ? "Secret saved" : "No secret saved"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{o.idLabel}</Label>
          <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} autoComplete="off" name={`${carrier}-key-id`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{o.secretLabel}</Label>
          <Input
            type="password"
            value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
            autoComplete="new-password"
            name={`${carrier}-key-secret`}
            placeholder={has ? "Saved. Type only to replace." : ""}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{o.accountLabel}</Label>
          <Input
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value.toUpperCase() })}
            autoComplete="off"
            name={`${carrier}-account`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Environment</Label>
          <Select value={form.env} onValueChange={(v) => setForm({ ...form, env: v as Env })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (test)</SelectItem>
              <SelectItem value="production">Production (live rates)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={o.onSave} disabled={o.saving}>
          {o.saving ? "Saving…" : `Save ${carrier === "ups" ? "UPS" : "FedEx"} keys`}
        </Button>
        <Button size="sm" variant="outline" onClick={o.onTest} disabled={o.testing || !has}>
          Test connection
        </Button>
        {status && (
          <span className={`inline-flex items-center gap-1 text-xs ${status.ok ? "text-green-700" : "text-red-700"}`}>
            {status.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {status.text}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Get keys at{" "}
        <a className="underline" href={o.portal} target="_blank" rel="noopener noreferrer">
          {o.portal.replace("https://", "")}
        </a>
        . Secrets are never shown again after saving.
      </p>
    </div>
  );
}

/** Always-visible area for typing UPS and FedEx API keys. Secrets are write-only. */
export default function CarrierKeysPanel() {
  const utils = trpc.useUtils();
  const { data } = trpc.freight.adminGet.useQuery();
  const [ups, setUps] = useState<CarrierForm>(empty);
  const [fedex, setFedex] = useState<CarrierForm>(empty);
  const [hasUps, setHasUps] = useState(false);
  const [hasFedex, setHasFedex] = useState(false);
  const [status, setStatus] = useState<Record<string, { ok: boolean; text: string } | undefined>>({});
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!data?.settings || seeded) return;
    const s = data.settings as Record<string, unknown>;
    setUps({
      id: (s.upsClientId as string) ?? "",
      secret: "",
      account: (s.upsAccountNumber as string) ?? "",
      env: (s.upsEnvironment as Env) ?? "sandbox",
    });
    setFedex({
      id: (s.fedexClientId as string) ?? "",
      secret: "",
      account: (s.fedexAccountNumber as string) ?? "",
      env: (s.fedexEnvironment as Env) ?? "sandbox",
    });
    setHasUps(!!s.hasUpsClientSecret);
    setHasFedex(!!s.hasFedexClientSecret);
    setSeeded(true);
  }, [data, seeded]);

  const saveUps = trpc.freight.saveUpsCredentials.useMutation({
    onSuccess: () => {
      setHasUps(true);
      setUps((c) => ({ ...c, secret: "" }));
      utils.freight.adminGet.invalidate();
      toast.success("UPS keys saved.");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveFedex = trpc.freight.saveFedexCredentials.useMutation({
    onSuccess: () => {
      setHasFedex(true);
      setFedex((c) => ({ ...c, secret: "" }));
      utils.freight.adminGet.invalidate();
      toast.success("FedEx keys saved.");
    },
    onError: (e) => toast.error(e.message),
  });
  const test = trpc.freight.testCarrierConnection.useMutation();

  async function runTest(carrier: "ups" | "fedex") {
    setStatus((s) => ({ ...s, [carrier]: undefined }));
    try {
      const r = await test.mutateAsync({ carrier });
      setStatus((s) => ({
        ...s,
        [carrier]: r.ok
          ? { ok: true, text: "Connected. The carrier accepted these keys." }
          : { ok: false, text: r.error ?? "Could not connect." },
      }));
    } catch (e) {
      setStatus((s) => ({ ...s, [carrier]: { ok: false, text: e instanceof Error ? e.message : "Could not connect." } }));
    }
  }

  return (
    <Card data-testid="carrier-keys-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Carrier keys: UPS and FedEx
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Paste your own keys here, save, then press Test connection. Small packages quote through UPS or FedEx parcel rating; pallets stay on freight.
        </p>
        <CarrierBlock
          carrier="ups"
          title="UPS"
          idLabel="Client ID"
          secretLabel="Client Secret"
          accountLabel="UPS account number"
          portal="https://developer.ups.com"
          form={ups}
          setForm={setUps}
          has={hasUps}
          saving={saveUps.isPending}
          status={status.ups}
          testing={test.isPending}
          onTest={() => runTest("ups")}
          onSave={() => {
            if (!ups.id.trim() || !ups.account.trim()) return void toast.error("Enter the UPS Client ID and account number.");
            saveUps.mutate({
              upsClientId: ups.id.trim(),
              upsClientSecret: ups.secret.trim() || undefined,
              upsAccountNumber: ups.account.trim(),
              upsEnvironment: ups.env,
            });
          }}
        />
        <CarrierBlock
          carrier="fedex"
          title="FedEx"
          idLabel="API Key"
          secretLabel="Secret Key"
          accountLabel="FedEx account number"
          portal="https://developer.fedex.com"
          form={fedex}
          setForm={setFedex}
          has={hasFedex}
          saving={saveFedex.isPending}
          status={status.fedex}
          testing={test.isPending}
          onTest={() => runTest("fedex")}
          onSave={() => {
            if (!fedex.id.trim() || !fedex.account.trim()) return void toast.error("Enter the FedEx API Key and account number.");
            saveFedex.mutate({
              fedexClientId: fedex.id.trim(),
              fedexClientSecret: fedex.secret.trim() || undefined,
              fedexAccountNumber: fedex.account.trim(),
              fedexEnvironment: fedex.env,
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
