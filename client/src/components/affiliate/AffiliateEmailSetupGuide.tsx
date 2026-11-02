import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, KeyRound, MousePointerClick } from "lucide-react";
import {
  AFFILIATE_EMAIL_SETUP_GUIDES,
  type AffiliateEmailProvider,
} from "@shared/affiliateEmailSettings";

/** Exact menu path for each provider, shown above the numbered steps. */
const PROVIDER_MENU_PATH: Record<AffiliateEmailProvider, string> = {
  yahoo: "Account Info > Account Security > Generate app password",
  gmail: "Google Account > Security > 2-Step Verification > App passwords",
  outlook: "Microsoft account > Security > Advanced security > App passwords",
  custom: "Ask your email provider for its mail server name and port",
};

const PROVIDER_NOTE: Record<AffiliateEmailProvider, string> = {
  yahoo: "Yahoo will not accept your normal Yahoo password in this form. It only accepts an app password.",
  gmail: "Google will not accept your normal Google password in this form. It only accepts an app password.",
  outlook: "Microsoft usually needs an app password for mail apps. Your work mailbox may be managed by your employer.",
  custom: "Your provider gave you these details when you set up the mailbox. Someone at your email company can read them to you.",
};

export function AffiliateEmailSetupGuide({ defaultProvider = "yahoo" }: { defaultProvider?: AffiliateEmailProvider }) {
  const [provider, setProvider] = useState<AffiliateEmailProvider>(defaultProvider);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4" data-testid="affiliate-email-setup-guide">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">How to set it up, step by step</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick the company that gives you your email address. Each one is only a few clicks.
        </p>
      </div>
      <Tabs value={provider} onValueChange={(value) => setProvider(value as AffiliateEmailProvider)}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {AFFILIATE_EMAIL_SETUP_GUIDES.map((guide) => (
            <TabsTrigger key={guide.key} value={guide.key} className="flex-none px-3">
              {guide.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {AFFILIATE_EMAIL_SETUP_GUIDES.map((guide) => (
          <TabsContent key={guide.key} value={guide.key} className="mt-3 space-y-4">
            <p className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
              <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-medium">Where to click: </span>
                {PROVIDER_MENU_PATH[guide.key]}
              </span>
            </p>

            <ol className="space-y-2 text-sm" data-testid={`affiliate-email-steps-${guide.key}`}>
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy,#1a2b4a)] text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                If the test email does not arrive
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {guide.failTips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
              <p className="mt-1.5">
                Still stuck? The test result shows the exact message your email provider sent back. Send us that message
                and we will tell you which field to fix.
              </p>
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {PROVIDER_NOTE[guide.key]}
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function AffiliateEmailConfiguredBadge({ hasAppPassword }: { hasAppPassword: boolean }) {
  return hasAppPassword ? (
    <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" aria-hidden /> Configured
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">Not configured</Badge>
  );
}
