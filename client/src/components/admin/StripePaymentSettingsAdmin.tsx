import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";

function statusLabel(configured: boolean): string {
  return configured ? "Configured" : "Needs setup";
}

function statusClass(configured: boolean): string {
  return configured
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function dateTime(value: Date | string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function StripePaymentSettingsAdmin() {
  const { data, isLoading, isError } = trpc.payments.adminGetStripeDashboard.useQuery();

  const setupSteps = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Live secret key",
        detail: "Stored only in protected project secrets; never in the website database or browser.",
        complete: data.secretKeyConfigured && data.environment === "production",
      },
      {
        label: "Live publishable key",
        detail: "Required so the customer checkout flow is paired to the same live Stripe account.",
        complete: data.publishableKeyConfigured && data.environment === "production",
      },
      {
        label: "Live webhook signing secret",
        detail: "Stripe must send checkout.session.completed to the CabinetDealz webhook before an order is confirmed paid.",
        complete: data.webhookConfigured && data.environment === "production",
      },
      {
        label: "Stripe live account activation",
        detail: "Complete business verification and bank payouts in the Stripe Dashboard before accepting customer payments.",
        complete: data.liveReady,
      },
    ];
  }, [data]);

  const copyWebhook = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.webhookUrl);
      toast.success("Live Stripe webhook URL copied");
    } catch {
      toast.error("Could not copy the webhook URL. Please copy it manually.");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Stripe configuration status could not be loaded. No credentials were exposed.
        </CardContent>
      </Card>
    );
  }

  const liveMode = data.environment === "production";
  return (
    <div className="space-y-6">
      <Card className={data.liveReady ? "border-emerald-300" : "border-amber-300"}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Stripe operations dashboard
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Manage live-readiness and monitor the hosted Checkout handoff. Card details, payout data, and Stripe secret keys stay in Stripe or protected project secrets.
              </CardDescription>
            </div>
            <Badge variant="outline" className={data.liveReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
              {data.liveReady ? "Live Checkout Ready" : liveMode ? "Live setup incomplete" : "Test mode"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4" /> Server secret key</div>
              <Badge variant="outline" className={statusClass(data.secretKeyConfigured)}>{statusLabel(data.secretKeyConfigured)}</Badge>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Publishable key</div>
              <Badge variant="outline" className={statusClass(data.publishableKeyConfigured)}>{statusLabel(data.publishableKeyConfigured)}</Badge>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Webhook className="h-4 w-4" /> Webhook signing secret</div>
              <Badge variant="outline" className={statusClass(data.webhookConfigured)}>{statusLabel(data.webhookConfigured)}</Badge>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><BadgeCheck className="h-4 w-4" /> Stripe environment</div>
              <Badge variant="outline" className={liveMode ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800"}>
                {liveMode ? "Live" : data.environment === "test" ? "Test" : "Unknown"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={data.stripeDashboardUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open Stripe Dashboard
              </a>
            </Button>
            <Button type="button" variant="outline" onClick={copyWebhook}>
              <ClipboardCopy className="mr-2 h-4 w-4" /> Copy live webhook URL
            </Button>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
            <p className="font-medium">Secure credential policy</p>
            <p className="mt-1">
              This Admin page intentionally does not accept or display Stripe secret keys. Store the live secret key, publishable key, and webhook signing secret through the protected project Payment/Secrets form so they never enter browser code or the CabinetDealz database.
            </p>
            <p className="mt-2 text-xs text-sky-800">
              Active credential source: <strong>{data.credentialSource === "protected_live_override" ? "protected CabinetDealz live entries" : "managed Stripe sandbox"}</strong>.
            </p>
          </div>
          {data.validationMessage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-medium">Stripe activation status</p>
              <p className="mt-1">{data.validationMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><LockKeyhole className="h-5 w-5" /> Live activation checklist</CardTitle>
            <CardDescription>Complete these steps in the Stripe Dashboard and protected project settings. The dashboard checks only safe status signals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupSteps.map((step, index) => (
              <div key={step.label} className="flex gap-3 rounded-lg border border-border p-3">
                {step.complete ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
                <div className="min-w-0">
                  <p className="font-medium">{index + 1}. {step.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
                </div>
                <Badge variant="outline" className={`ml-auto h-fit shrink-0 ${statusClass(step.complete)}`}>{step.complete ? "Done" : "Action needed"}</Badge>
              </div>
            ))}
            <Separator />
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">Webhook endpoint</p>
              <code className="mt-1 block break-all text-xs text-muted-foreground">{data.webhookUrl}</code>
              <p className="mt-2 text-xs text-muted-foreground">Subscribe the live Stripe endpoint to <strong>checkout.session.completed</strong>.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Landmark className="h-5 w-5" /> Hosted Checkout activity</CardTitle>
            <CardDescription>Recent CabinetDealz Checkout sessions. Stripe remains the source of truth for card and payout details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 p-3"><p className="text-xl font-semibold">{data.activity.createdCount}</p><p className="text-xs text-muted-foreground">Created</p></div>
              <div className="rounded-lg bg-amber-50 p-3"><p className="text-xl font-semibold text-amber-800">{data.activity.awaitingPaymentCount}</p><p className="text-xs text-amber-800">Awaiting payment</p></div>
              <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xl font-semibold text-emerald-800">{data.activity.paidCheckoutCount}</p><p className="text-xs text-emerald-800">Paid</p></div>
            </div>
            {data.recentCheckout.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No hosted Stripe Checkout sessions have been created yet.</div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {data.recentCheckout.map((checkout) => (
                  <div key={checkout.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{checkout.requestNumber}</p><p className="text-xs text-muted-foreground">{dateTime(checkout.createdAt)}</p></div><Badge variant="outline" className={checkout.state === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : checkout.state === "awaiting_payment" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}>{checkout.state === "paid" ? "Paid" : checkout.state === "awaiting_payment" ? "Awaiting payment" : "Checkout created"}</Badge></div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Merchandise</span><span>{money(checkout.merchandiseCents)}</span></div>
                    {checkout.paidAt && <p className="mt-1 text-xs text-emerald-700">Paid {dateTime(checkout.paidAt)}</p>}
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="outline" className="w-full"><a href={data.stripeDashboardUrl} target="_blank" rel="noreferrer"><ReceiptText className="mr-2 h-4 w-4" /> View payment and payout details in Stripe</a></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
