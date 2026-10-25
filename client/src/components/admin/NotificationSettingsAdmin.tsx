import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Bell, ShieldCheck, Info } from "lucide-react";

interface Form {
  onNewOrder: string;
  onNewDesignLead: string;
  onNewQuoteRequest: string;
  onNewProApplication: string;
  onNewConsultation: string;
  onNewAffiliate: string;
  onCrmDesignHelp: string;
  onCrmShippingHelp: string;
  notifyOnCrmDesignHelp: boolean;
  notifyOnCrmShippingHelp: boolean;
  enabled: boolean;
}

type EventRecipientKey =
  | "onNewOrder"
  | "onNewDesignLead"
  | "onNewQuoteRequest"
  | "onNewProApplication"
  | "onNewConsultation"
  | "onNewAffiliate";

const EVENTS: { key: EventRecipientKey; label: string; description: string }[] = [
  {
    key: "onNewOrder",
    label: "New Order",
    description: "Triggered when a customer submits an order request.",
  },
  {
    key: "onNewDesignLead",
    label: "New Design Lead",
    description: "Triggered when someone submits a kitchen design for review.",
  },
  {
    key: "onNewQuoteRequest",
    label: "New Quote Request",
    description: "Triggered when a countertop or custom quote is submitted.",
  },
  {
    key: "onNewProApplication",
    label: "New Pro Application",
    description: "Triggered when a contractor or dealer applies for a trade account.",
  },
  {
    key: "onNewConsultation",
    label: "New Consultation Booking",
    description: "Triggered when a design consultation is booked.",
  },
  {
    key: "onNewAffiliate",
    label: "New Affiliate Sign-up",
    description: "Triggered when a new affiliate account is created.",
  },
];

export default function NotificationSettingsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.emailSettings.getNotificationSettings.useQuery();
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        onNewOrder: data.onNewOrder ?? "",
        onNewDesignLead: data.onNewDesignLead ?? "",
        onNewQuoteRequest: data.onNewQuoteRequest ?? "",
        onNewProApplication: data.onNewProApplication ?? "",
        onNewConsultation: data.onNewConsultation ?? "",
        onNewAffiliate: data.onNewAffiliate ?? "",
        onCrmDesignHelp: data.onCrmDesignHelp ?? "",
        onCrmShippingHelp: data.onCrmShippingHelp ?? "",
        notifyOnCrmDesignHelp: data.notifyOnCrmDesignHelp ?? false,
        notifyOnCrmShippingHelp: data.notifyOnCrmShippingHelp ?? false,
        enabled: data.enabled ?? true,
      });
    }
  }, [data]);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = trpc.emailSettings.saveNotificationSettings.useMutation({
    onSuccess: () => {
      toast.success("Notification settings saved");
      utils.emailSettings.getNotificationSettings.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  if (isLoading || !form) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Global toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Notification Emails</CardTitle>
          </div>
          <CardDescription>
            Configure which email addresses receive alerts for each event. Separate multiple addresses
            with commas. Requires SMTP to be configured and enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Enable notification emails</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master switch — when off, no notification emails are sent for any event.
              </p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Per-event configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Event Recipients</CardTitle>
          <CardDescription>
            Enter one or more email addresses per event (comma-separated). Leave blank to skip
            notifications for that event.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {EVENTS.map(({ key, label, description }) => (
            <div key={key} className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground -mt-0.5">{description}</p>
              <Input
                value={form[key]}
                onChange={(e) => set({ [key]: e.target.value } as Partial<Form>)}
                placeholder="admin@cabinetdealz.com, sales@cabinetdealz.com"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">CRM Help Team Alerts</CardTitle>
          <CardDescription>
            Route a newly requested CRM help type to its own internal team. Recipient lists can be saved while alerts are off; no email sends until the matching switch, the master notification switch, and SMTP are all enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">CRM Design Help</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Sent once when a deal changes to Needs Help Designing.</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="notify-crm-design-help" className="text-xs text-muted-foreground">Enable Design Help alerts</Label>
                <Switch
                  id="notify-crm-design-help"
                  aria-label="Enable Design Help alerts"
                  checked={form.notifyOnCrmDesignHelp}
                  onCheckedChange={(notifyOnCrmDesignHelp) => set({ notifyOnCrmDesignHelp })}
                />
              </div>
            </div>
            <Input
              value={form.onCrmDesignHelp}
              onChange={(e) => set({ onCrmDesignHelp: e.target.value })}
              placeholder="design@cabinetdealz.com, designer@example.com"
              aria-label="CRM Design Help team recipients"
            />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">CRM Shipping Cost Help</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Sent once when a deal changes to Needs Help Shipping Costs.</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="notify-crm-shipping-help" className="text-xs text-muted-foreground">Enable Shipping Cost Help alerts</Label>
                <Switch
                  id="notify-crm-shipping-help"
                  aria-label="Enable Shipping Cost Help alerts"
                  checked={form.notifyOnCrmShippingHelp}
                  onCheckedChange={(notifyOnCrmShippingHelp) => set({ notifyOnCrmShippingHelp })}
                />
              </div>
            </div>
            <Input
              value={form.onCrmShippingHelp}
              onChange={(e) => set({ onCrmShippingHelp: e.target.value })}
              placeholder="shipping@cabinetdealz.com, freight@example.com"
              aria-label="CRM Shipping Cost Help team recipients"
            />
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Notification emails are sent using the SMTP credentials configured in the{" "}
          <strong>Email Settings</strong> tab. Make sure SMTP is configured and enabled before
          activating notifications.
        </span>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
          {save.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Save Notifications
        </Button>
      </div>
    </div>
  );
}
