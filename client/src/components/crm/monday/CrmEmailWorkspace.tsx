import { useEffect, useMemo, useRef, useState } from "react";
import {
  CRM_BUILTIN_EMAIL_TEMPLATES,
  CRM_EMAIL_MERGE_FIELDS,
  CRM_SMTP_PRESETS,
  applyCrmMergeFields,
  type CrmEmailProvider,
  type PublicAffiliateEmailSettings,
} from "@shared/crmMailbox";
import { CRM_STAGES, CRM_STAGE_LABELS, type CrmStage } from "@shared/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type MailboxRow = {
  kind: "sent" | "draft";
  id: number;
  dealId: number | null;
  toEmail: string;
  subject: string;
  body: string;
  at: string | Date;
  title: string;
  stage: string | null;
  contactName: string | null;
};

export type EmailContact = {
  id: number;
  title: string;
  contactName: string | null;
  contactEmail: string | null;
  stage: string;
  estimatedValue?: string | number | null;
};

export type EmailTemplateRow = { id: number; name: string; subject: string; bodyHtml: string; affiliateId?: number | null };

export type EmailConnectionRow = {
  affiliateId: number;
  storeName: string;
  publicEmail: string;
  connected: boolean;
  provider: string | null;
  fromName: string;
  replyTo: string;
  smtpUser: string;
  enabled: boolean;
  hasPassword: boolean;
  lastTestOk: boolean | null;
};

export type EmailPrefill = {
  dealId: number;
  to?: string;
  contactName?: string;
  dealTitle?: string;
  estimatedValue?: string;
  stage?: string;
  designLink?: string;
  quoteLink?: string;
  storeName?: string;
};

type SetupDraft = {
  provider: CrmEmailProvider;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  fromName: string;
  replyTo: string;
  signatureHtml: string;
  enabled: boolean;
};

const emptySetup = (): SetupDraft => ({
  provider: "gmail",
  smtpHost: CRM_SMTP_PRESETS.gmail.host,
  smtpPort: CRM_SMTP_PRESETS.gmail.port,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  fromName: "",
  replyTo: "",
  signatureHtml: "",
  enabled: true,
});

export function CrmEmailWorkspaceView({
  audience,
  contacts,
  mailbox,
  templates,
  settings,
  connections,
  prefill,
  setupInitiallyOpen = false,
  onSend,
  onSaveDraft,
  onDeleteDraft,
  onSaveSetup,
  onTestSetup,
  onSaveTemplate,
  onDeleteTemplate,
}: {
  audience: "affiliate" | "admin";
  contacts: EmailContact[];
  mailbox: MailboxRow[];
  templates: EmailTemplateRow[];
  settings: PublicAffiliateEmailSettings | null;
  connections: EmailConnectionRow[];
  prefill: EmailPrefill | null;
  setupInitiallyOpen?: boolean;
  onSend: (input: { dealId: number; to: string; subject: string; body: string; html: string; draftId?: number }) => Promise<void>;
  onSaveDraft: (input: { id?: number; dealId: number | null; toEmail: string; subject: string; bodyHtml: string }) => Promise<void>;
  onDeleteDraft: (id: number) => Promise<void>;
  onSaveSetup: (input: SetupDraft) => Promise<void>;
  onTestSetup: (input: SetupDraft & { to: string }) => Promise<void>;
  onSaveTemplate: (input: { id?: number; name: string; subject: string; bodyHtml: string }) => Promise<void>;
  onDeleteTemplate: (id: number) => Promise<void>;
}) {
  const [setupOpen, setSetupOpen] = useState(setupInitiallyOpen);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [status, setStatus] = useState<"all" | "sent" | "draft">("all");
  const [stage, setStage] = useState<"all" | CrmStage>("all");
  const [dealFilter, setDealFilter] = useState<string>("all");
  const [draftId, setDraftId] = useState<number | undefined>();
  const [dealId, setDealId] = useState<number | "">("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [setup, setSetup] = useState<SetupDraft>(emptySetup);
  const [testTo, setTestTo] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<number | undefined>();
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settings) return;
    setSetup((current) => ({
      ...current,
      provider: (CRM_SMTP_PRESETS[settings.provider as CrmEmailProvider] ? settings.provider : "custom") as CrmEmailProvider,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
      fromName: settings.fromName,
      replyTo: settings.replyTo,
      signatureHtml: settings.signatureHtml,
      enabled: settings.enabled,
      smtpPass: "",
    }));
  }, [settings]);

  useEffect(() => {
    if (!prefill) return;
    setDealId(prefill.dealId);
    setTo(prefill.to ?? "");
    setSubject("");
    if (editorRef.current) editorRef.current.innerHTML = `<p>Hi ${prefill.contactName || ""},</p>`;
  }, [prefill]);

  const selected = contacts.find((contact) => contact.id === dealId);
  const mergeFields = {
    contactName: selected?.contactName || prefill?.contactName || "",
    contactEmail: to,
    dealTitle: selected?.title || prefill?.dealTitle || "",
    storeName: prefill?.storeName || "Cabinet Dealz",
    estimatedValue: selected?.estimatedValue != null ? String(selected.estimatedValue) : prefill?.estimatedValue || "",
    stage: selected?.stage || prefill?.stage || "",
    designLink: prefill?.designLink || "",
    quoteLink: prefill?.quoteLink || "",
    signature: setup.signatureHtml,
  };

  const visibleMail = useMemo(() => mailbox.filter((row) => {
    if (status !== "all" && row.kind !== status) return false;
    if (stage !== "all" && row.stage !== stage) return false;
    if (dealFilter !== "all" && String(row.dealId ?? "") !== dealFilter) return false;
    return true;
  }), [mailbox, status, stage, dealFilter]);

  function html() {
    return editorRef.current?.innerHTML ?? "";
  }

  function insertHtml(snippet: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, snippet);
  }

  function applyTemplate(subjectTemplate: string, bodyTemplate: string) {
    setSubject(applyCrmMergeFields(subjectTemplate, mergeFields));
    if (editorRef.current) editorRef.current.innerHTML = applyCrmMergeFields(bodyTemplate, mergeFields);
  }

  return (
    <div className="space-y-4" data-testid="crm-email-workspace">
      <section className="rounded-xl border border-slate-200 bg-white">
        <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setSetupOpen((open) => !open)}>
          <span>
            <span className="block text-sm font-semibold text-[#1a2b4a]">Email setup</span>
            <span className="text-xs text-slate-500">
              {audience === "affiliate"
                ? (settings?.connected ? `Connected via ${settings.provider}` : "Not connected — CRM mail falls back to Cabinet Dealz")
                : "Affiliate connection status. Passwords stay on the server."}
            </span>
          </span>
          <span className="text-xs text-[#c9a227]">{setupOpen ? "Hide" : "Show"}</span>
        </button>
        {setupOpen && (
          <div className="border-t border-slate-100 px-4 py-4">
            {audience === "affiliate" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">Provider
                  <select className="mt-1 w-full rounded-md border px-2 py-2 text-sm" value={setup.provider} onChange={(event) => {
                    const provider = event.target.value as CrmEmailProvider;
                    const preset = CRM_SMTP_PRESETS[provider];
                    setSetup((current) => ({ ...current, provider, smtpHost: preset.host || current.smtpHost, smtpPort: preset.port }));
                  }}>
                    {Object.entries(CRM_SMTP_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
                  </select>
                </label>
                <p className="text-xs text-slate-500 md:col-span-2">{CRM_SMTP_PRESETS[setup.provider].hint}</p>
                <Field label="SMTP host"><Input value={setup.smtpHost} onChange={(event) => setSetup({ ...setup, smtpHost: event.target.value })} /></Field>
                <Field label="Port"><Input type="number" value={setup.smtpPort} onChange={(event) => setSetup({ ...setup, smtpPort: Number(event.target.value) })} /></Field>
                <Field label="Username"><Input value={setup.smtpUser} onChange={(event) => setSetup({ ...setup, smtpUser: event.target.value })} autoComplete="off" /></Field>
                <Field label={settings?.hasPassword ? "Password (leave blank to keep saved)" : "Password"}>
                  <Input type="password" value={setup.smtpPass} onChange={(event) => setSetup({ ...setup, smtpPass: event.target.value })} autoComplete="new-password" />
                </Field>
                <Field label="From address"><Input value={setup.smtpFrom} onChange={(event) => setSetup({ ...setup, smtpFrom: event.target.value })} /></Field>
                <Field label="From name"><Input value={setup.fromName} onChange={(event) => setSetup({ ...setup, fromName: event.target.value })} /></Field>
                <Field label="Reply-to"><Input value={setup.replyTo} onChange={(event) => setSetup({ ...setup, replyTo: event.target.value })} /></Field>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" checked={setup.enabled} onChange={(event) => setSetup({ ...setup, enabled: event.target.checked })} />
                  Use this mailbox for CRM sends
                </label>
                <label className="text-xs font-medium text-slate-600 md:col-span-2">Signature
                  <textarea className="mt-1 min-h-20 w-full rounded-md border px-2 py-2 text-sm" value={setup.signatureHtml} onChange={(event) => setSetup({ ...setup, signatureHtml: event.target.value })} />
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button type="button" onClick={() => onSaveSetup(setup)}>Save connection</Button>
                  <Input className="max-w-xs" placeholder="Send test to" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
                  <Button type="button" variant="outline" onClick={() => onTestSetup({ ...setup, to: testTo })}>Send test</Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-1">Store</th><th>Status</th><th>Provider</th><th>Mailbox</th><th>Reply-to</th><th>Last test</th></tr>
                  </thead>
                  <tbody>
                    {connections.map((row) => (
                      <tr key={row.affiliateId} className="border-t">
                        <td className="py-2 font-medium">{row.storeName}</td>
                        <td>{row.connected ? "Connected" : "Platform fallback"}</td>
                        <td>{row.provider ?? "—"}</td>
                        <td>{row.smtpUser || "—"}</td>
                        <td>{row.replyTo || row.publicEmail}</td>
                        <td>{row.lastTestOk == null ? "—" : row.lastTestOk ? "OK" : "Failed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-500">House mail still uses Admin → Email Settings. Stored passwords are not shown.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-100 p-3">
            <select aria-label="Mailbox status" className="w-full rounded border px-2 py-1 text-xs" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="all">Sent and drafts</option>
              <option value="sent">Sent</option>
              <option value="draft">Drafts</option>
            </select>
            <select aria-label="Mailbox stage" className="w-full rounded border px-2 py-1 text-xs" value={stage} onChange={(event) => setStage(event.target.value as typeof stage)}>
              <option value="all">All stages</option>
              {CRM_STAGES.map((item) => <option key={item} value={item}>{CRM_STAGE_LABELS[item].en}</option>)}
            </select>
            <select aria-label="Mailbox deal" className="w-full rounded border px-2 py-1 text-xs" value={dealFilter} onChange={(event) => setDealFilter(event.target.value)}>
              <option value="all">All deals</option>
              {contacts.map((contact) => <option key={contact.id} value={String(contact.id)}>{contact.contactName || contact.title}</option>)}
            </select>
          </div>
          <ul className="max-h-[28rem] overflow-y-auto">
            {visibleMail.length === 0 && <li className="p-3 text-xs text-slate-500">No messages in this view.</li>}
            {visibleMail.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <button
                  className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-amber-50"
                  onClick={() => {
                    if (row.kind === "draft") {
                      setDraftId(row.id);
                      setDealId(row.dealId ?? "");
                      setTo(row.toEmail);
                      setSubject(row.subject);
                      if (editorRef.current) editorRef.current.innerHTML = row.body;
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold ${row.kind === "draft" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>{row.kind}</span>
                    <span className="text-[10px] text-slate-400">{new Date(row.at).toLocaleDateString()}</span>
                  </div>
                  <div className="truncate text-sm font-medium text-[#1a2b4a]">{row.subject || "(no subject)"}</div>
                  <div className="truncate text-xs text-slate-500">{row.contactName || row.title} · {row.toEmail}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={async (event) => {
          event.preventDefault();
          if (dealId === "") { toast.error("Choose a deal"); return; }
          const bodyHtml = html();
          const text = editorRef.current?.innerText?.trim() ?? "";
          await onSend({ dealId, to, subject, body: text || subject, html: bodyHtml, draftId });
          setDraftId(undefined);
        }}>
          <div className="flex flex-wrap gap-2">
            <select aria-label="To" className="min-w-48 flex-1 rounded border px-2 py-2 text-sm" value={to} onChange={(event) => {
              const contact = contacts.find((item) => item.contactEmail === event.target.value);
              setTo(event.target.value);
              if (contact) setDealId(contact.id);
            }}>
              <option value="">Choose a CRM contact</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.contactEmail ?? ""}>{contact.contactName || contact.title} · {contact.contactEmail}</option>)}
            </select>
            <Input className="max-w-xs" placeholder="Or type an email" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Recipient email" />
          </div>
          <Input placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Subject" />
          <div className="flex flex-wrap gap-1">
            <EditorButton label="Bold" onClick={() => document.execCommand("bold")} />
            <EditorButton label="Italic" onClick={() => document.execCommand("italic")} />
            <EditorButton label="Link" onClick={() => {
              const url = window.prompt("Link URL");
              if (url) document.execCommand("createLink", false, url);
            }} />
            <EditorButton label="Image" onClick={() => {
              const url = window.prompt("Image URL");
              if (url) insertHtml(`<img src="${url.replace(/"/g, "")}" alt="" style="max-width:100%" />`);
            }} />
            {CRM_EMAIL_MERGE_FIELDS.map((field) => (
              <EditorButton key={field} label={`{{${field}}}`} onClick={() => insertHtml(`{{${field}}}`)} />
            ))}
            <EditorButton label="Design link" onClick={() => insertHtml(prefill?.designLink || "{{designLink}}")} />
            <EditorButton label="Quote link" onClick={() => insertHtml(prefill?.quoteLink || "{{quoteLink}}")} />
            <EditorButton label="Signature" onClick={() => insertHtml(setup.signatureHtml || "{{signature}}")} />
          </div>
          <div className="flex flex-wrap gap-1">
            {CRM_BUILTIN_EMAIL_TEMPLATES.map((template) => (
              <Button key={template.key} type="button" size="sm" variant="outline" onClick={() => applyTemplate(template.subject, template.bodyHtml)}>{template.name}</Button>
            ))}
            {templates.map((template) => (
              <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => applyTemplate(template.subject, template.bodyHtml)}>{template.name}</Button>
            ))}
          </div>
          <div
            ref={editorRef}
            className="min-h-40 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a227]"
            contentEditable
            role="textbox"
            aria-label="Email body"
            suppressContentEditableWarning
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Send</Button>
            <Button type="button" variant="outline" onClick={() => onSaveDraft({ id: draftId, dealId: dealId === "" ? null : dealId, toEmail: to, subject, bodyHtml: html() })}>Save draft</Button>
            {draftId != null && <Button type="button" variant="ghost" onClick={() => onDeleteDraft(draftId)}>Delete draft</Button>}
          </div>
          <p className="text-xs text-slate-500">Mail goes out only when you click Send. Affiliate deals use that store's mailbox, or Cabinet Dealz with the store name and public reply-to.</p>
        </form>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setTemplatesOpen((open) => !open)}>
          <span className="text-sm font-semibold text-[#1a2b4a]">Template manager</span>
          <span className="text-xs text-[#c9a227]">{templatesOpen ? "Hide" : "Show"}</span>
        </button>
        {templatesOpen && (
          <div className="space-y-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">Follow-up, Quote ready, and Design ready are built in. Save your own copies below.</p>
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-xs" placeholder="Template name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              <Button type="button" variant="outline" onClick={async () => {
                if (!templateName.trim()) return;
                await onSaveTemplate({ id: editingTemplateId, name: templateName.trim(), subject, bodyHtml: html() });
                setTemplateName("");
                setEditingTemplateId(undefined);
              }}>{editingTemplateId ? "Update template" : "Save template"}</Button>
            </div>
            <ul className="space-y-1">
              {templates.map((template) => (
                <li key={template.id} className="flex items-center justify-between gap-2 text-sm">
                  <button type="button" className="text-left hover:underline" onClick={() => { setEditingTemplateId(template.id); setTemplateName(template.name); applyTemplate(template.subject, template.bodyHtml); }}>{template.name}</button>
                  <button type="button" className="text-xs text-red-600" onClick={() => onDeleteTemplate(template.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-medium text-slate-600">{label}<div className="mt-1">{children}</div></label>;
}

function EditorButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="rounded border border-slate-200 px-2 py-1 text-[11px] text-[#1a2b4a] hover:bg-amber-50" onClick={onClick}>{label}</button>;
}

export function CrmEmailWorkspace({
  audience,
  showConnections = false,
  prefill,
}: {
  audience: "affiliate" | "admin";
  showConnections?: boolean;
  prefill: EmailPrefill | null;
}) {
  const utils = trpc.useUtils();
  const contacts = trpc.crm.emailContacts.useQuery();
  const mailbox = trpc.crm.emailMailbox.list.useQuery();
  const templates = trpc.crm.emailTemplates.list.useQuery();
  const setup = trpc.crm.emailSetup.get.useQuery(undefined, { enabled: audience === "affiliate" });
  const connections = trpc.crm.emailSetup.connections.useQuery(undefined, { enabled: showConnections });
  const send = trpc.crm.sendEmail.useMutation();
  const saveDraft = trpc.crm.emailDrafts.save.useMutation();
  const deleteDraft = trpc.crm.emailDrafts.remove.useMutation();
  const saveSetup = trpc.crm.emailSetup.save.useMutation();
  const testSetup = trpc.crm.emailSetup.testSend.useMutation();
  const saveTemplate = trpc.crm.emailTemplates.save.useMutation();
  const deleteTemplate = trpc.crm.emailTemplates.remove.useMutation();

  async function refresh() {
    await Promise.all([
      utils.crm.emailMailbox.list.invalidate(),
      utils.crm.emailDrafts.list.invalidate(),
      utils.crm.emailTemplates.list.invalidate(),
      utils.crm.board.invalidate(),
    ]);
  }

  return (
    <CrmEmailWorkspaceView
      audience={audience}
      contacts={(contacts.data ?? []) as EmailContact[]}
      mailbox={(mailbox.data ?? []) as MailboxRow[]}
      templates={(templates.data ?? []) as EmailTemplateRow[]}
      settings={setup.data?.settings ?? null}
      connections={(connections.data ?? []) as EmailConnectionRow[]}
      prefill={prefill}
      onSend={async (input) => {
        await send.mutateAsync(input);
        toast.success("Email sent");
        await refresh();
      }}
      onSaveDraft={async (input) => {
        await saveDraft.mutateAsync(input);
        toast.success("Draft saved");
        await refresh();
      }}
      onDeleteDraft={async (id) => {
        await deleteDraft.mutateAsync({ id });
        toast.success("Draft deleted");
        await refresh();
      }}
      onSaveSetup={async (input) => {
        await saveSetup.mutateAsync(input);
        toast.success("Email connection saved");
        await utils.crm.emailSetup.get.invalidate();
      }}
      onTestSetup={async (input) => {
        await testSetup.mutateAsync(input);
        toast.success("Test email sent");
      }}
      onSaveTemplate={async (input) => {
        await saveTemplate.mutateAsync(input);
        toast.success("Template saved");
        await utils.crm.emailTemplates.list.invalidate();
      }}
      onDeleteTemplate={async (id) => {
        await deleteTemplate.mutateAsync({ id });
        await utils.crm.emailTemplates.list.invalidate();
      }}
    />
  );
}
