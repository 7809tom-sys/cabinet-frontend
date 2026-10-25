import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, ShieldCheck, Send, KeyRound, CheckCircle2, XCircle, Wand2 } from "lucide-react";

interface Form {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  enabled: boolean;
}

const HOSTINGER_SMTP_HOST = "smtp.hostinger.com";
const HOSTINGER_SMTP_PORT = "465";

export default function EmailSettingsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.emailSettings.getEmailSettings.useQuery();
  const [form, setForm] = useState<Form | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const savedSettingsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (data) {
      const next: Form = {
        smtpHost: data.smtpHost ?? "",
        smtpPort: String(data.smtpPort ?? 465),
        smtpUser: data.smtpUser ?? "",
        smtpPass: "", // never prefill password
        smtpFrom: data.smtpFrom ?? "",
        enabled: data.enabled ?? false,
      };
      const savedKey = [
        next.smtpHost,
        next.smtpPort,
        next.smtpUser,
        next.smtpFrom,
        String(next.enabled),
        String(data.hasPassword ?? false),
      ].join("\u0001");
      const previousSavedKey = savedSettingsKeyRef.current;

      setForm((current) => {
        // React Query may refetch while someone is completing the form. Keep
        // their local values unless they still match the last saved record or
        // this is the first load / a successful save returned new settings.
        const matchesSaved = current &&
          current.smtpHost.trim() === next.smtpHost.trim() &&
          current.smtpPort === next.smtpPort &&
          current.smtpUser.trim() === next.smtpUser.trim() &&
          current.smtpFrom.trim() === next.smtpFrom.trim() &&
          current.enabled === next.enabled &&
          !current.smtpPass.trim();
        if (!current || matchesSaved || previousSavedKey !== savedKey) {
          return next;
        }
        return current;
      });
      savedSettingsKeyRef.current = savedKey;
      if (!testEmail && data.smtpUser) setTestEmail(data.smtpUser);
    }
  }, [data]);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = trpc.emailSettings.saveEmailSettings.useMutation({
    onSuccess: () => {
      toast.success("Email settings saved");
      utils.emailSettings.getEmailSettings.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  const testConnection = trpc.emailSettings.testEmailConnection.useMutation({
    onMutate: () => setTesting(true),
    onSettled: () => setTesting(false),
    onSuccess: (res) => {
      if (res.ok) toast.success("Test email sent successfully!");
      else toast.error("Test failed", { description: res.error ?? "Unknown error" });
    },
    onError: (e) => toast.error("Test failed", { description: e.message }),
  });

  if (isLoading || !form) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  const hasPassword = data?.hasPassword ?? false;
  const isConfigured = !!(data?.smtpHost && data?.smtpUser && hasPassword);
  const missingSavedSettings = [
    !data?.smtpHost ? "SMTP host" : null,
    !data?.smtpUser ? "SMTP username" : null,
    !hasPassword ? "SMTP password" : null,
  ].filter((value): value is string => Boolean(value));
  const hasUnsavedChanges = Boolean(
    data && (
      form.smtpHost.trim() !== (data.smtpHost ?? "").trim()
      || (parseInt(form.smtpPort, 10) || 465) !== (data.smtpPort ?? 465)
      || form.smtpUser.trim() !== (data.smtpUser ?? "").trim()
      || form.smtpFrom.trim() !== (data.smtpFrom ?? "").trim()
      || form.enabled !== (data.enabled ?? false)
      || form.smtpPass.trim().length > 0
    )
  );
  const canSendTest = Boolean(testEmail.trim() && isConfigured && !testing && !hasUnsavedChanges);

  function onSave() {
    if (!form) return;
    save.mutate({
      smtpHost: form.smtpHost.trim(),
      smtpPort: parseInt(form.smtpPort, 10) || 465,
      smtpUser: form.smtpUser.trim(),
      smtpFrom: form.smtpFrom.trim() || form.smtpUser.trim(),
      enabled: form.enabled,
      ...(form.smtpPass.trim() ? { smtpPass: form.smtpPass.trim() } : {}),
    });
  }

  function applyHostingerPreset() {
    if (!form) return;
    set({
      smtpHost: HOSTINGER_SMTP_HOST,
      smtpPort: HOSTINGER_SMTP_PORT,
      smtpFrom: form.smtpFrom.trim() || form.smtpUser.trim(),
    });
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Email / SMTP</CardTitle>
            </div>
            <Badge
              className={
                isConfigured && form.enabled
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }
            >
              {isConfigured && form.enabled ? "Active" : isConfigured ? "Configured (disabled)" : "Not configured"}
            </Badge>
          </div>
          <CardDescription>
            Configure your Hostinger (or other SMTP) sending account for outbound order confirmations,
            quote replies, and manual-render notifications. Saved passwords are never returned to this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-sm">Enable email sending</p>
                <Badge variant={form.enabled ? "default" : "secondary"} className={form.enabled ? "bg-emerald-700 text-white" : ""}>
                  {form.enabled ? "On — sending enabled" : "Off — sending paused"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                When off, no transactional emails are sent even if credentials are saved.
              </p>
            </div>
            <Switch aria-label="Enable email sending" checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
          </div>

          {/* SMTP fields */}
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">Using an existing Hostinger mailbox?</p>
              <p className="text-xs text-amber-900/80">Use the preset to fill `smtp.hostinger.com` and port 465. Then enter the mailbox’s full email address and password, save, and test.</p>
            </div>
            <Button type="button" variant="outline" className="shrink-0 gap-1 border-amber-300 bg-white" onClick={applyHostingerPreset}>
              <Wand2 className="h-4 w-4" /> Use Hostinger preset
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SMTP Host</Label>
              <Input
                placeholder="smtp.titan.email"
                value={form.smtpHost}
                onChange={(e) => set({ smtpHost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Port</Label>
              <Input
                type="number"
                placeholder="465"
                value={form.smtpPort}
                onChange={(e) => set({ smtpPort: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">465 = SSL · 587 = TLS/STARTTLS</p>
            </div>
            <div className="space-y-1.5">
              <Label>Username (email address)</Label>
              <Input
                placeholder="sales@cabinetdealz.com"
                value={form.smtpUser}
                onChange={(e) => set({ smtpUser: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Password
                {hasPassword && !form.smtpPass && (
                  <span className="text-xs text-emerald-600 font-normal">(saved — leave blank to keep)</span>
                )}
              </Label>
              <Input
                type="password"
                placeholder={hasPassword ? "••••••••" : "Enter password"}
                value={form.smtpPass}
                onChange={(e) => set({ smtpPass: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>From address (optional)</Label>
              <Input
                placeholder="Cabinet Dealz &lt;sales@cabinetdealz.com&gt;"
                value={form.smtpFrom}
                onChange={(e) => set({ smtpFrom: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Defaults to username if left blank.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={save.isPending}>
              {save.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test connection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Test Connection</CardTitle>
          </div>
          <CardDescription>
            Send a test email using the <strong>saved</strong> credentials to verify the connection works.
            Save any changes first; the test button remains unavailable until the saved settings are current.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              disabled={!canSendTest}
              onClick={() => testConnection.mutate({ toEmail: testEmail.trim() })}
            >
              {testing ? <Spinner className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Test Email
            </Button>
          </div>
          {!isConfigured && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Test unavailable until the saved settings include {missingSavedSettings.join(", ") || "SMTP credentials"}. Use the Hostinger preset above, then Save Settings before testing.
            </p>
          )}
          {isConfigured && hasUnsavedChanges && (
            <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Save your email-setting changes before sending a test message.
            </p>
          )}
          {isConfigured && !hasUnsavedChanges && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved connection ready. Enter an email address and click Send Test Email.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
