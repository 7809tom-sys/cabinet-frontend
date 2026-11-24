import { AlertCircle, CheckCircle2, ExternalLink, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DOMAIN_MAIL_HOST_GUIDES,
  type DomainMailHostGuide,
} from "@shared/affiliateEmailSettings";
import type { AffiliateDomainRecordCheck } from "@/lib/affiliateEmailSettingsProcedures";

type Props = {
  /** The domain the mailbox lives on, like yourstore.com. */
  domain: string;
  /** True when this domain is the store's own domain from Domain Setup. */
  isStoreDomain: boolean;
  /** Fills the mail server and port above for the chosen host. Omitted when read-only. */
  onUseSettings?: (guide: DomainMailHostGuide) => void;
  /** Result of the read-only DNS check, when it has loaded. */
  records?: AffiliateDomainRecordCheck | null;
  /** Opens the Domain Setup tab. */
  onOpenDomainSetup?: () => void;
};

function RecordStatus({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
      <CheckCircle2 className="h-3 w-3" aria-hidden /> {label} found
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
      <AlertCircle className="h-3 w-3" aria-hidden /> {label} not found
    </Badge>
  );
}

/**
 * Instructions for sending customer email from a mailbox on the store's own
 * domain. Values come from `DOMAIN_MAIL_HOST_GUIDES`, which cites each
 * provider's help page.
 */
export function AffiliateDomainMailGuide({ domain, isStoreDomain, onUseSettings, records, onOpenDomainSetup }: Props) {
  const checked = records && records.domain === domain && records.reliable ? records : null;
  return (
    <Card data-testid="affiliate-domain-mail-guide">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">Email from your own domain ({domain})</CardTitle>
        </div>
        <CardDescription>
          {isStoreDomain
            ? "Your store has its own domain, so customers will trust email that comes from it. Pick where your mailbox is hosted."
            : "This address is on your own domain. Pick where that mailbox is hosted and follow the steps."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {checked ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="affiliate-domain-records-status">
            <RecordStatus ok={checked.spf} label="SPF" />
            <RecordStatus ok={checked.dkimSelector != null} label="DKIM" />
            <RecordStatus ok={checked.dmarc} label="DMARC" />
            <span className="text-xs text-muted-foreground">
              Public DNS check for {domain}. New records can take a few hours to show.
            </span>
          </div>
        ) : null}

        <Tabs defaultValue="hostinger" className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {DOMAIN_MAIL_HOST_GUIDES.map((guide) => (
              <TabsTrigger key={guide.key} value={guide.key} className="text-xs">{guide.label}</TabsTrigger>
            ))}
          </TabsList>
          {DOMAIN_MAIL_HOST_GUIDES.map((guide) => (
            <TabsContent key={guide.key} value={guide.key} className="mt-4 space-y-4">
              <div>
                <p className="font-medium">1. Create the mailbox</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {guide.createMailbox.map((step) => <li key={step}>{step}</li>)}
                </ul>
              </div>

              <div>
                <p className="font-medium">2. Sending settings for this page</p>
                <dl className="mt-1 grid gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-[9rem_1fr]">
                  <dt className="font-medium">Mail server</dt>
                  <dd className="font-mono">{guide.smtp.host || "Ask your provider"}</dd>
                  <dt className="font-medium">Port</dt>
                  <dd>{guide.smtp.port}</dd>
                  <dt className="font-medium">Security</dt>
                  <dd>{guide.smtp.security}</dd>
                  <dt className="font-medium">Username</dt>
                  <dd>{guide.smtp.username}</dd>
                  <dt className="font-medium">Password</dt>
                  <dd>{guide.smtp.password}</dd>
                </dl>
                {onUseSettings ? (
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onUseSettings(guide)}>
                    Use these settings
                  </Button>
                ) : null}
              </div>

              <div>
                <p className="font-medium">3. Add DNS records so your email is not marked as spam</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add these where your domain's DNS is managed (the same place as in Domain Setup).
                  {" "}Use only one SPF record per domain.
                </p>
                <div className="mt-2 overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50">
                      <tr><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Name</th><th className="px-2 py-1.5">Value</th></tr>
                    </thead>
                    <tbody>
                      {guide.dns(domain).map((record) => (
                        <tr key={`${record.type}-${record.name}`} className="border-t align-top">
                          <td className="px-2 py-1.5 font-mono">{record.type}</td>
                          <td className="px-2 py-1.5 font-mono">{record.name}</td>
                          <td className="px-2 py-1.5">
                            <span className="break-all font-mono">{record.value}</span>
                            {record.note ? <span className="mt-0.5 block text-muted-foreground">{record.note}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {onOpenDomainSetup ? (
                  <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={onOpenDomainSetup}>
                    Open Domain Setup
                  </Button>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">
                After saving, click Send test email. The test only goes to your own address.
              </p>

              {guide.sources.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium">Provider help pages</p>
                  <ul className="mt-1 space-y-0.5">
                    {guide.sources.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                          {url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
