import { AlertCircle, CheckCircle2, MailWarning } from "lucide-react";
import type { PublicAffiliateEmailSettings } from "@shared/crmMailbox";
import type { AffiliateDomainRecordCheck } from "@/lib/affiliateEmailSettingsProcedures";

export type CrmSenderState =
  | { kind: "unavailable" }
  | { kind: "not_connected" }
  | { kind: "off"; mailbox: string }
  | { kind: "connected"; mailbox: string; test: "ok" | "failed" | "never"; testError: string | null };

/** Which mailbox CRM mail leaves from, in plain words. Pure so it is easy to test. */
export function crmSenderState(
  settings: PublicAffiliateEmailSettings | null,
  unavailable: boolean,
): CrmSenderState {
  if (unavailable) return { kind: "unavailable" };
  if (!settings || !settings.hasPassword || !(settings.smtpHost ?? "").trim()) return { kind: "not_connected" };
  const mailbox = (settings.smtpFrom || settings.contactEmail || settings.smtpUser || "").trim();
  if (!settings.connected) return { kind: "off", mailbox };
  return {
    kind: "connected",
    mailbox,
    test: settings.lastTestOk == null ? "never" : settings.lastTestOk ? "ok" : "failed",
    testError: settings.lastTestError ?? null,
  };
}

/** Records still missing for an own-domain mailbox. Empty when unchecked or all found. */
export function missingDomainRecords(records: AffiliateDomainRecordCheck | null | undefined): string[] {
  if (!records || !records.domain || !records.reliable) return [];
  const missing: string[] = [];
  if (!records.spf) missing.push("SPF");
  if (!records.dkimSelector) missing.push("DKIM");
  if (!records.dmarc) missing.push("DMARC");
  return missing;
}

export function CrmSenderStatus({
  settings,
  unavailable,
  records,
  hasOwnDomain,
}: {
  settings: PublicAffiliateEmailSettings | null;
  unavailable: boolean;
  records?: AffiliateDomainRecordCheck | null;
  /** The store has its own domain, so Domain Setup is relevant even before the records load. */
  hasOwnDomain?: boolean;
}) {
  const state = crmSenderState(settings, unavailable);
  const missing = missingDomainRecords(records);
  const link = "font-medium underline underline-offset-2";
  const good = state.kind === "connected" && state.test !== "failed";
  return (
    <div
      data-testid="crm-sender-status"
      className={`rounded-xl border px-4 py-3 text-sm ${good && missing.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}
    >
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {good && missing.length === 0 ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <MailWarning className="h-4 w-4" aria-hidden />}
        {state.kind === "unavailable" && "Sender settings are unavailable right now"}
        {state.kind === "not_connected" && "Your own mailbox is not connected"}
        {state.kind === "off" && "Your mailbox is saved but switched off"}
        {state.kind === "connected" && `CRM emails go out from ${state.mailbox || "your mailbox"}`}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        {state.kind === "unavailable" && "Email still works the usual way. Your sender settings need a database update before they can show here. We have logged the details."}
        {state.kind === "not_connected" && "Until you connect it, CRM email goes out from CabinetDealz with your store name and your reply-to address."}
        {state.kind === "off" && "Turn it on in Email settings so CRM email goes out from your own address."}
        {state.kind === "connected" && state.test === "ok" && "Connected. The last test email was delivered."}
        {state.kind === "connected" && state.test === "never" && "Connected. You have not sent a test email yet. Send one from Email settings."}
        {state.kind === "connected" && state.test === "failed" && `The last test email failed${state.testError ? `: ${state.testError}` : "."} Check the app password and server in Email settings.`}
      </p>
      {missing.length > 0 ? (
        <p className="mt-1 text-xs leading-relaxed" data-testid="crm-sender-domain-warning">
          Your domain is missing {missing.join(", ")} records, so customers' mail providers may send your email to spam.
        </p>
      ) : null}
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a className={link} href="/affiliate?section=email">Email settings</a>
        {(hasOwnDomain || missing.length > 0) ? <a className={link} href="/affiliate?section=settings">Domain Setup</a> : null}
        {state.kind === "connected" && state.test === "failed" ? (
          <span className="inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" aria-hidden /> Fix before sending to customers</span>
        ) : null}
      </p>
    </div>
  );
}
