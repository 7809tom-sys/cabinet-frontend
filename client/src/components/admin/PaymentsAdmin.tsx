import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CreditCard, ShieldCheck, Loader2, KeyRound } from "lucide-react";

function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    declined: "bg-amber-100 text-amber-800 border-amber-200",
    error: "bg-red-100 text-red-800 border-red-200",
    pending: "bg-slate-100 text-slate-700 border-slate-200",
    refunded: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return map[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

export default function PaymentsAdmin() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.payments.adminGetSettings.useQuery();
  const { data: txns } = trpc.payments.adminList.useQuery({ limit: 100 });

  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [apiLoginId, setApiLoginId] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [transactionKey, setTransactionKey] = useState(""); // write-only

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setEnvironment(settings.environment);
      setApiLoginId(settings.apiLoginId);
      setClientKey(settings.clientKey);
      setTransactionKey(""); // never prefill the secret
    }
  }, [settings]);

  const save = trpc.payments.adminSaveSettings.useMutation({
    onSuccess: () => {
      toast.success("Payment settings saved");
      setTransactionKey("");
      utils.payments.adminGetSettings.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  const hasKey = settings?.hasTransactionKey ?? false;
  const canEnable = Boolean(apiLoginId.trim() && clientKey.trim() && (transactionKey.trim() || hasKey));

  function onSave() {
    if (enabled && !canEnable) {
      toast.error("Complete all credentials before enabling payments.");
      return;
    }
    save.mutate({
      enabled,
      environment,
      apiLoginId: apiLoginId.trim(),
      clientKey: clientKey.trim(),
      // Only send the secret when the admin actually typed a new one.
      ...(transactionKey.trim() ? { transactionKey: transactionKey.trim() } : {}),
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Authorize.Net Payments
              </CardTitle>
              <CardDescription className="mt-1">
                Charge customers 100% upfront with a tokenized card form (Accept.js). Card data
                never touches our servers. Payment is collected only after a live freight quote is
                attached, so the total always includes shipping.
              </CardDescription>
            </div>
            <Badge variant="outline" className={enabled ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}>
              {enabled ? "Live on checkout" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Accept online card payments</Label>
              <p className="text-sm text-muted-foreground">
                Turn on to show the card form at checkout once shipping is quoted.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
                  <SelectItem value="production">Production (live charges)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sandbox uses Authorize.Net test gateway; switch to Production only with live credentials.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiLoginId">API Login ID</Label>
              <Input id="apiLoginId" value={apiLoginId} onChange={(e) => setApiLoginId(e.target.value)} placeholder="e.g. 5KP3u95bQpv" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientKey">Public Client Key</Label>
              <Input id="clientKey" value={clientKey} onChange={(e) => setClientKey(e.target.value)} placeholder="Public client key for Accept.js" autoComplete="off" />
              <p className="text-xs text-muted-foreground">Safe to expose to the browser (used for tokenization).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transactionKey" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Transaction Key (secret)
              </Label>
              <Input
                id="transactionKey"
                type="password"
                value={transactionKey}
                onChange={(e) => setTransactionKey(e.target.value)}
                placeholder={hasKey ? "•••••••• (stored — leave blank to keep)" : "Enter transaction key"}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {hasKey ? "A key is stored. Leave blank to keep it." : "Stored server-side only; never shown again."}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={save.isPending} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Most recent charge attempts. Amounts include cabinets, fees, and freight.</CardDescription>
        </CardHeader>
        <CardContent>
          {!txns || txns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Freight</TableHead>
                    <TableHead>Card</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead>Txn ID</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.requestNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge(t.status)}>{t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCents(t.amountCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCents(t.freightCents)}</TableCell>
                      <TableCell className="text-sm">
                        {t.cardType ? `${t.cardType} ••${t.cardLast4 ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{t.environment}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.transactionId ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
