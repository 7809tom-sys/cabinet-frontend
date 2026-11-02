import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, Save, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAffiliateEmailSettingsProcedures } from "@/lib/affiliateEmailSettingsProcedures";
import {
  AFFILIATE_APP_PASSWORD_HELP,
  AFFILIATE_EMAIL_PRESETS,
  AFFILIATE_EMAIL_PROVIDERS,
  AFFILIATE_EMAIL_STATUS_LABELS,
  AFFILIATE_INVOICE_COPY_NOTE,
  affiliateEmailDraftDirty,
  affiliateEmailDraftFromView,
  affiliateEmailStatus,
  applyAffiliateEmailPreset,
  buildAffiliateEmailSettingsUpdate,
  isAffiliateEmailProvider,
  type AffiliateEmailProvider,
  type AffiliateEmailSettingsDraft,
  type AffiliateEmailSettingsTestResult,
  type AffiliateEmailSettingsView,
} from "@shared/affiliateEmailSettings";
import { AffiliateEmailConfiguredBadge, AffiliateEmailSetupGuide } from "./AffiliateEmailSetupGuide";

type Props = {
  /** The store whose mailbox this is. The server re-checks ownership. */
  affiliateId?: number;
  /** Owner/admin only. A team member without ownership sees a read-only note. */
  canEdit: boolean;
  /** Shown in the card description so the owner knows which store they are editing. */
  storeName?: string;
};

const PROVIDER_FIELD_LABEL: Record<AffiliateEmailProvider, string> = {
  yahoo: "Yahoo app password",
  gmail: "Google app password",
  outlook: "Microsoft app password",
  custom: "Password from your email provider",
};

export function AffiliateEmailSettingsPanel({ affiliateId, canEdit, storeName }: Props) {
  const api = useAffiliateEmailSettingsProcedures();
  const utils = api.useUtils();
  const query = api.affiliateEmailSettings.get.useQuery(
    { affiliateId: affiliateId ?? 0 },
    { enabled: affiliateId != null && affiliateId > 0, retry: false },
  );
  const saved = query.data ?? null;
  const editable = canEdit && (saved?.canEdit ?? true);

  const [draft, setDraft] = useState<AffiliateEmailSettingsDraft>(() => affiliateEmailDraftFromView(null));
  const [fieldError, setFieldError] = useState<{ field: keyof AffiliateEmailSettingsDraft; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AffiliateEmailSettingsTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const lastLoadedRef = useRef<string | null>(null);

  // Reload the form from the server, but never wipe what the owner is typing:
  // a background refetch keeps their values until they save.
  useEffect(() => {
    if (!saved) return;
    const key = [
      saved.email, saved.provider, saved.smtpHost, String(saved.smtpPort),
      saved.username, String(saved.enabled), String(saved.hasAppPassword),
    ].join("\u0001");
    if (lastLoadedRef.current === key) return;
    const firstLoad = lastLoadedRef.current === null;
    lastLoadedRef.current = key;
    setDraft((current) => {
      if (firstLoad) return affiliateEmailDraftFromView(saved);
      const untouched = !affiliateEmailDraftDirty(current, saved);
      return untouched ? affiliateEmailDraftFromView(saved) : current;
    });
  }, [saved]);

  const save = api.affiliateEmailSettings.update.useMutation({
    onSuccess: (next) => {
      setFieldError(null);
      setSaveError(null);
      setTestResult(null);
      setTestError(null);
      setDraft(affiliateEmailDraftFromView(next));
      toast.success("Email settings saved");
      void utils.affiliateEmailSettings.get.invalidate({ affiliateId: next.affiliateId });
    },
    onError: (error) => {
      const message = error.message || "Could not save your email settings.";
      setSaveError(message);
      toast.error(message);
    },
  });

  const sendTest = api.affiliateEmailSettings.sendTest.useMutation({
    onMutate: () => {
      setTesting(true);
      setTestResult(null);
      setTestError(null);
    },
    onSettled: () => setTesting(false),
    onSuccess: (result) => {
      setTestResult(result);
      if (result.ok) toast.success(`Test email sent to ${result.to}`);
      else toast.error(result.error || "The test email did not send.");
      if (affiliateId != null && affiliateId > 0) {
        void utils.affiliateEmailSettings.get.invalidate({ affiliateId });
      }
    },
    onError: (error) => {
      const message = error.message || "The test email did not send.";
      setTestError(message);
      toast.error(message);
    },
  });

  function set(patch: Partial<AffiliateEmailSettingsDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    if (fieldError) setFieldError(null);
    if (saveError) setSaveError(null);
    if (testResult) setTestResult(null);
  }

  function onSave() {
    if (affiliateId == null || affiliateId <= 0) {
      setFieldError({ field: "email", message: "Choose a store before saving email settings." });
      return;
    }
    const checked = buildAffiliateEmailSettingsUpdate({
      affiliateId,
      draft,
      hasAppPassword: hasSavedPassword,
    });
    if (!checked.ok) {
      setFieldError({ field: checked.field, message: checked.message });
      toast.error(checked.message);
      return;
    }
    save.mutate(checked.input);
  }

  function onSendTest() {
    if (affiliateId == null || affiliateId <= 0) return;
    setTestResult(null);
    setTestError(null);
    sendTest.mutate({ affiliateId });
  }

  if (affiliateId == null || affiliateId <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Choose a store to edit its email settings.
      </div>
    );
  }

  if (query.isLoading) {
    return <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>;
  }

  if (query.error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {query.error.message}
      </div>
    );
  }

  if (!editable) {
    return <AffiliateEmailReadOnly storeName={storeName} />;
  }

  const status = affiliateEmailStatus(saved);
  const provider = isAffiliateEmailProvider(draft.provider) ? draft.provider : "custom";
  const preset = AFFILIATE_EMAIL_PRESETS[provider];
  // A saved app password belongs to the provider it was created for. After a
  // provider switch it must be re-entered, or the old password is silently
  // sent to a different mail server.
  const providerChanged = saved != null && draft.provider !== saved.provider;
  const hasSavedPassword = Boolean(saved?.hasAppPassword) && !providerChanged;
  const dirty = affiliateEmailDraftDirty(draft, saved);
  const passwordPlaceholder = hasSavedPassword
    ? "Saved — leave blank to keep it"
    : PROVIDER_FIELD_LABEL[provider];
  const fieldErrorFor = (field: keyof AffiliateEmailSettingsDraft) => (
    fieldError?.field === field ? fieldError.message : null
  );

  return (
    <div className="max-w-3xl space-y-6" data-testid="affiliate-email-settings">
      <div>
        <h2 className="text-xl font-bold">Email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The email address your customers see, and the mailbox CabinetDealz uses to send quotes and invoices
          {storeName ? ` from ${storeName}` : ""}.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Your customer email</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={status === "active"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : status === "configured_disabled"
                    ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                    : "text-muted-foreground"}
              >
                {AFFILIATE_EMAIL_STATUS_LABELS[status]}
              </Badge>
              <AffiliateEmailConfiguredBadge hasAppPassword={hasSavedPassword} />
            </div>
          </div>
          <CardDescription>
            Enter the normal email address you use to talk to your customers. It is the address they will see and reply to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="affiliate-email-address">Your email address</Label>
            <Input
              id="affiliate-email-address"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="rich@reaveswaycabinets.com"
              value={draft.email}
              onChange={(event) => set({ email: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              This is not your CabinetDealz sign-in. It is the mailbox you already use with your customers.
            </p>
            {fieldErrorFor("email") ? <p role="alert" className="text-xs text-destructive">{fieldErrorFor("email")}</p> : null}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Use this mailbox to send email</p>
                <Badge variant={draft.enabled ? "default" : "secondary"} className={draft.enabled ? "bg-emerald-700 text-white" : ""}>
                  {draft.enabled ? "On — sending enabled" : "Off — nothing is sent"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                When this is off, your saved details stay here but no customer email goes out from this mailbox.
              </p>
            </div>
            <Switch
              aria-label="Use this mailbox to send email"
              checked={draft.enabled}
              onCheckedChange={(checked) => set({ enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Sending settings</CardTitle>
          </div>
          <CardDescription>
            Pick your email company and we fill in the server details. The only thing you add is an app password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-medium">{AFFILIATE_APP_PASSWORD_HELP[provider].headline}</p>
            <p className="mt-0.5 text-xs leading-relaxed">{AFFILIATE_APP_PASSWORD_HELP[provider].detail}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="affiliate-email-provider">Email provider</Label>
              <Select
                value={provider}
                onValueChange={(value) => {
                  if (!isAffiliateEmailProvider(value)) return;
                  setDraft((current) => applyAffiliateEmailPreset(current, value));
                  if (fieldError) setFieldError(null);
                }}
              >
                <SelectTrigger id="affiliate-email-provider" aria-label="Email provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AFFILIATE_EMAIL_PROVIDERS.map((key) => (
                    <SelectItem key={key} value={key}>{AFFILIATE_EMAIL_PRESETS[key].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{preset.summary}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="affiliate-email-smtp-host">Mail server</Label>
              <Input
                id="affiliate-email-smtp-host"
                placeholder={preset.host || "smtp.yourprovider.com"}
                value={draft.smtpHost}
                onChange={(event) => set({ smtpHost: event.target.value })}
                readOnly={provider !== "custom"}
                className={provider !== "custom" ? "bg-muted/50" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                {provider === "custom"
                  ? "Use the server name your provider gave you."
                  : "Filled in for you from the provider you picked."}
              </p>
              {fieldErrorFor("smtpHost") ? <p role="alert" className="text-xs text-destructive">{fieldErrorFor("smtpHost")}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="affiliate-email-smtp-port">Port</Label>
              <Input
                id="affiliate-email-smtp-port"
                type="number"
                inputMode="numeric"
                value={String(draft.smtpPort)}
                onChange={(event) => set({ smtpPort: event.target.value })}
                readOnly={provider !== "custom"}
                className={provider !== "custom" ? "bg-muted/50" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                {Number(draft.smtpPort) === 465 ? "465 uses SSL — the usual choice." : "587 is the other common port."}
              </p>
              {fieldErrorFor("smtpPort") ? <p role="alert" className="text-xs text-destructive">{fieldErrorFor("smtpPort")}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="affiliate-email-username">Username</Label>
              <Input
                id="affiliate-email-username"
                autoComplete="off"
                placeholder={draft.email || "you@yourstore.com"}
                value={draft.username}
                onChange={(event) => set({ username: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">Usually the same as your email address.</p>
              {fieldErrorFor("username") ? <p role="alert" className="text-xs text-destructive">{fieldErrorFor("username")}</p> : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="affiliate-email-app-password">{PROVIDER_FIELD_LABEL[provider]}</Label>
                <AffiliateEmailConfiguredBadge hasAppPassword={hasSavedPassword} />
              </div>
              <Input
                id="affiliate-email-app-password"
                type="password"
                autoComplete="new-password"
                placeholder={passwordPlaceholder}
                value={draft.appPassword}
                onChange={(event) => set({ appPassword: event.target.value })}
                aria-describedby="affiliate-email-app-password-help"
              />
              <p id="affiliate-email-app-password-help" className="text-xs text-muted-foreground">
                {providerChanged
                  ? `You changed the provider, so paste the app password your ${preset.label} account generated. The saved password belongs to the previous provider.`
                  : hasSavedPassword
                    ? "A password is already saved. We never show it again. Leave this blank to keep it, or paste a new one to replace it."
                    : "Paste the app password your email provider generated. It is saved privately and never shown again."}
              </p>
              {fieldErrorFor("appPassword") ? <p role="alert" className="text-xs text-destructive">{fieldErrorFor("appPassword")}</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" data-testid="affiliate-invoice-copy-note">
            <p className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-medium">Copy to CabinetDealz.</span>{" "}
                {AFFILIATE_INVOICE_COPY_NOTE}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
            <Button type="button" onClick={onSave} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save email settings
            </Button>
          </div>

          {saveError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {saveError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Send test email</CardTitle>
          </div>
          <CardDescription>
            We send one message to your saved email address using your saved settings. Save any changes first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onSendTest}
              disabled={testing || sendTest.isPending || !saved?.configured || dirty}
            >
              {testing || sendTest.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Send className="mr-2 h-4 w-4" />}
              Send test email
            </Button>
            <p className="text-xs text-muted-foreground">
              {saved?.email ? `Goes to ${saved.email}.` : "Save your email address first."}
            </p>
          </div>

          {!saved?.configured ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              Fill in your email address, username, and app password, then save before testing.
            </p>
          ) : dirty ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              Save your changes before sending a test email.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Saved settings are ready to test.
            </p>
          )}

          {testResult?.ok ? (
            <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              Test email sent to {testResult.to}. Check that inbox, and the spam folder, then you are done.
            </div>
          ) : null}

          {testResult && !testResult.ok ? (
            <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">The test email did not send.</p>
              <p className="break-words font-mono text-xs" data-testid="affiliate-email-test-error">
                {testResult.error || "No details came back from your email provider."}
              </p>
              <p className="text-xs">
                The message above is exactly what your email provider said. Fix that field, save, and try again.
              </p>
            </div>
          ) : null}

          {testError ? (
            <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">The test email did not send.</p>
              <p className="break-words font-mono text-xs" data-testid="affiliate-email-test-error">{testError}</p>
            </div>
          ) : null}

          {saved?.lastTestedAt && !testResult && !testError ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Previous test {new Date(saved.lastTestedAt).toLocaleString()}:
              {saved.lastTestOk
                ? <span className="text-emerald-700 dark:text-emerald-300">delivered</span>
                : <span className="text-destructive">failed</span>}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AffiliateEmailSetupGuide defaultProvider={provider} />
    </div>
  );
}

/**
 * Gate for a login that is not this store's owner and not a platform admin.
 * It deliberately shows no address, host, or username: another affiliate's
 * team member must not be able to read any of it.
 */
function AffiliateEmailReadOnly({ storeName }: { storeName?: string }) {
  return (
    <div className="max-w-2xl space-y-4" data-testid="affiliate-email-settings-read-only">
      <div>
        <h2 className="text-xl font-bold">Email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {storeName ? `${storeName} keeps its customer email here.` : "This store keeps its customer email here."}
        </p>
      </div>
      <div className="rounded-xl border border-border p-4 text-sm">
        <p className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
          Only the store owner or a CabinetDealz administrator can see or change these email settings.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <span className="font-medium">Copy to CabinetDealz.</span> {AFFILIATE_INVOICE_COPY_NOTE}
      </div>
    </div>
  );
}
