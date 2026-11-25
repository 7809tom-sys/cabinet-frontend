// Admin CRM → Outreach. Settings, enrolment, preview, approval queue, contacts,
// suppression list and audit log for the AI follow-up outreach engine.
// Real sends only happen on the server scheduler when OUTREACH_ENABLED=true AND
// the switch here is on AND the mode is approval or automatic.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OutreachTip } from "./OutreachTip";
import type { OutreachTipId } from "./outreachTips";
import {
  OUTREACH_CAP_LIMITS,
  OUTREACH_ENROLLMENT_STATUS_LABELS,
  OUTREACH_MODES,
  OUTREACH_MODE_LABELS,
  type OutreachSettings,
  type OutreachStep,
} from "@shared/crmOutreach";

type QueueStatus = "pending_approval" | "approved" | "preview" | "sent" | "failed" | "rejected" | "skipped";
const QUEUE_LABELS: Record<QueueStatus, string> = {
  pending_approval: "Waiting for approval",
  approved: "Approved (sends on schedule)",
  preview: "Preview drafts",
  sent: "Sent",
  failed: "Failed",
  rejected: "Rejected",
  skipped: "Skipped",
};

function when(value: unknown): string {
  if (!value) return "—";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";
}

function Section({ title, tip, children }: { title: string; tip?: OutreachTipId; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-1">
        <h4 className="font-semibold text-foreground">{title}</h4>
        {tip && <OutreachTip id={tip} />}
      </div>
      {children}
    </section>
  );
}

export function OutreachPanel() {
  const utils = trpc.useUtils();
  const status = trpc.crmOutreach.status.useQuery(undefined, { retry: false, refetchInterval: 60000 });
  const [form, setForm] = useState<OutreachSettings | null>(null);
  useEffect(() => { if (status.data?.settings && !form) setForm(status.data.settings as OutreachSettings); }, [status.data, form]);
  const save = trpc.crmOutreach.saveSettings.useMutation({
    onSuccess: (next) => { setForm(next as OutreachSettings); toast.success("Outreach settings saved."); utils.crmOutreach.status.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  if (status.error) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">{status.error.message}</div>;
  }
  if (!status.data || !form) return <p className="text-sm text-muted-foreground">Loading outreach…</p>;
  const data = status.data;

  const updateStep = (index: number, patch: Partial<OutreachStep>) => {
    setForm({ ...form, sequence: form.sequence.map((step, i) => (i === index ? { ...step, ...patch } : step)) });
  };

  return (
    <div className="space-y-4">
      <Section title="Status" tip="status">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={data.sendingLive ? "bg-green-600 text-white" : "bg-slate-200 text-slate-800"}>{data.sendingLive ? "Sending is live" : "Not sending"}</Badge>
          <Badge variant="outline">Mode in effect: {data.effectiveMode}</Badge>
          <Badge variant="outline">Sent in last 24 h: {data.sentLast24h}</Badge>
          <Badge variant="outline">Suppressed addresses: {data.suppressed}</Badge>
        </div>
        {data.notes.length > 0 && <ul className="list-disc pl-5 text-sm text-muted-foreground">{data.notes.map((note: string) => <li key={note}>{note}</li>)}</ul>}
        <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div><dt className="inline font-medium">OUTREACH_ENABLED: </dt><dd className="inline">{data.env.envEnabled ? "true" : "off"}</dd></div>
          <div><dt className="inline font-medium">Postal address in footer: </dt><dd className="inline">{data.env.mailingAddress || "not set"}</dd></div>
          <div><dt className="inline font-medium">Replies go to: </dt><dd className="inline">{data.env.replyTo}</dd></div>
          <div><dt className="inline font-medium">Reply detection: </dt><dd className="inline">{data.env.replyDetection ? "on" : "off (mark replies by hand)"}</dd></div>
          <div><dt className="inline font-medium">Bounce events: </dt><dd className="inline">{data.env.bounceEvents ? "on" : "off (send failures still suppress)"}</dd></div>
          <div><dt className="inline font-medium">AI drafting: </dt><dd className="inline">{data.env.aiConfigured ? "on" : "off (fixed templates)"}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Contacts: {Object.entries(data.enrollments).map(([key, n]) => `${OUTREACH_ENROLLMENT_STATUS_LABELS[key] ?? key} ${n}`).join(" · ") || "none enrolled"}
        </p>
      </Section>

      <Section title="Settings">
        <div className="flex items-center gap-3">
          <Switch id="outreach-enabled" checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />
          <Label htmlFor="outreach-enabled">Outreach on (also needs OUTREACH_ENABLED=true on the server)</Label>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-1"><Label>Mode</Label><OutreachTip id="mode" /></div>
            <Select value={form.mode} onValueChange={(mode) => setForm({ ...form, mode: mode as OutreachSettings["mode"] })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{OUTREACH_MODES.map((mode) => <SelectItem key={mode} value={mode}>{OUTREACH_MODE_LABELS[mode]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1"><Label htmlFor="outreach-daily">Daily cap (emails / 24 h)</Label><OutreachTip id="dailyCap" /></div>
            <Input id="outreach-daily" type="number" min={0} max={OUTREACH_CAP_LIMITS.dailyCapMax} value={form.dailyCap} onChange={(e) => setForm({ ...form, dailyCap: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1"><Label htmlFor="outreach-per-contact">Max emails per contact</Label><OutreachTip id="perContactCap" /></div>
            <Input id="outreach-per-contact" type="number" min={1} max={OUTREACH_CAP_LIMITS.perContactCapMax} value={form.perContactCap} onChange={(e) => setForm({ ...form, perContactCap: Number(e.target.value) })} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="outreach-sender">Signature / sender name</Label>
            <Input id="outreach-sender" value={form.senderName} maxLength={128} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Sequence</p>
          {form.sequence.map((step, index) => (
            <div key={index} className="grid gap-2 rounded border border-border p-3 md:grid-cols-6">
              <div className="space-y-1 md:col-span-2"><div className="flex items-center gap-1"><Label className="text-xs">Step {index + 1} name</Label>{index === 0 && <OutreachTip id="firstContact" />}{index === 1 && <OutreachTip id="followUp" />}</div><Input value={step.label} maxLength={64} onChange={(e) => updateStep(index, { label: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{index === 0 ? "Days after enrolling" : "Days after previous"}</Label><Input type="number" min={0} max={OUTREACH_CAP_LIMITS.maxDelayDays} value={step.delayDays} onChange={(e) => updateStep(index, { delayDays: Number(e.target.value) })} /></div>
              <div className="space-y-1 md:col-span-3"><div className="flex items-center gap-1"><Label className="text-xs">Offer (your exact words; leave blank for none)</Label>{index === 0 && <OutreachTip id="offer" />}</div><Input value={step.offerText} maxLength={200} placeholder="e.g. a free design consultation" onChange={(e) => updateStep(index, { offerText: e.target.value })} /></div>
              <div className="space-y-1 md:col-span-6"><Label className="text-xs">What this email is for (the AI's brief)</Label><Textarea rows={2} value={step.goal} maxLength={600} onChange={(e) => updateStep(index, { goal: e.target.value })} /></div>
              <div className="md:col-span-6 flex justify-end"><Button type="button" size="sm" variant="ghost" disabled={form.sequence.length <= 1} onClick={() => setForm({ ...form, sequence: form.sequence.filter((_, i) => i !== index) })}>Remove step</Button></div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" disabled={form.sequence.length >= OUTREACH_CAP_LIMITS.maxSteps} onClick={() => setForm({ ...form, sequence: [...form.sequence, { key: `step_${form.sequence.length + 1}`, label: "Follow-up", delayDays: 14, goal: "A short, friendly check-in that invites a reply.", offerText: "" }] })}>Add step</Button>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer">AI instructions (read-only)</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-2">{data.systemPrompt}</pre>
        </details>
        <Button disabled={save.isPending} onClick={() => save.mutate(form)} className="bg-[var(--color-navy,#1a2b4a)] text-white">{save.isPending ? "Saving…" : "Save settings"}</Button>
      </Section>

      <EnrollSection sourceTags={data.sourceTags} />
      <QueueSection />
      <ContactsSection />
      <SuppressionSection />
      <AuditSection />
    </div>
  );
}

function EnrollSection({ sourceTags }: { sourceTags: Array<{ sourceTag: string; contacts: number }> }) {
  const utils = trpc.useUtils();
  const [tag, setTag] = useState("");
  const enroll = trpc.crmOutreach.enroll.useMutation({
    onSuccess: (result) => { toast.success(`${result.enrolled} enrolled, ${result.skipped} skipped (suppressed, already enrolled, won/lost, or no valid email).`); utils.crmOutreach.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Section title="Enrol a customer list" tip="enroll">
      <p className="text-sm text-muted-foreground">Enrolling schedules the sequence. Nothing is sent until outreach is on and the mode allows it.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="w-72 bg-white" aria-label="Customer list"><SelectValue placeholder="Pick an imported list" /></SelectTrigger>
          <SelectContent>{sourceTags.map((row) => <SelectItem key={row.sourceTag} value={row.sourceTag}>{row.sourceTag} ({row.contacts.toLocaleString()})</SelectItem>)}</SelectContent>
        </Select>
        <Button disabled={!tag || enroll.isPending} variant="outline" onClick={() => { if (window.confirm(`Enrol every contact from "${tag}" in the outreach sequence?`)) enroll.mutate({ sourceTag: tag }); }}>Enrol list</Button>
      </div>
    </Section>
  );
}

function QueueSection() {
  const utils = trpc.useUtils();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("pending_approval");
  const queue = trpc.crmOutreach.queue.useQuery({ status: queueStatus, limit: 50 });
  const [editing, setEditing] = useState<{ id: number; subject: string; bodyText: string } | null>(null);
  const done = (message: string) => { toast.success(message); utils.crmOutreach.invalidate(); };
  const approve = trpc.crmOutreach.approve.useMutation({ onSuccess: () => done("Approved. They send on the next scheduled run, within the caps."), onError: (e) => toast.error(e.message) });
  const reject = trpc.crmOutreach.reject.useMutation({ onSuccess: () => done("Rejected."), onError: (e) => toast.error(e.message) });
  const edit = trpc.crmOutreach.editDraft.useMutation({ onSuccess: () => { setEditing(null); done("Draft updated."); }, onError: (e) => toast.error(e.message) });
  const test = trpc.crmOutreach.sendTestToOwner.useMutation({ onSuccess: (r) => toast.success(`Test copy sent to ${r.to}. The customer got nothing.`), onError: (e) => toast.error(e.message) });
  const rows = queue.data ?? [];
  const actionable = queueStatus === "pending_approval" || queueStatus === "preview";
  return (
    <Section title="Drafts and approval queue" tip="approveQueue">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={queueStatus} onValueChange={(v) => setQueueStatus(v as QueueStatus)}>
          <SelectTrigger className="w-64 bg-white" aria-label="Queue filter"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(QUEUE_LABELS) as QueueStatus[]).map((key) => <SelectItem key={key} value={key}>{QUEUE_LABELS[key]}</SelectItem>)}</SelectContent>
        </Select>
        {actionable && rows.length > 0 && <Button size="sm" variant="outline" onClick={() => { if (window.confirm(`Approve all ${rows.length} drafts shown?`)) approve.mutate({ ids: rows.map((r: { id: number }) => r.id) }); }}>Approve all shown</Button>}
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here.</p> : (
        <div className="space-y-3">
          {rows.map((row: { id: number; toEmail: string; contactName: string | null; stepIndex: number; subject: string; bodyText: string; draftSource: string; status: string; error: string | null; sentAt: unknown; createdAt: unknown }) => (
            <div key={row.id} className="rounded border border-border p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{row.contactName ?? row.toEmail}</span><span>{row.toEmail}</span>
                <Badge variant="outline">Step {row.stepIndex + 1}</Badge>
                <Badge variant="outline">{row.draftSource === "ai" ? "AI draft" : "Fixed template"}</Badge>
                <span>{row.status === "sent" ? `Sent ${when(row.sentAt)}` : `Drafted ${when(row.createdAt)}`}</span>
                {row.error && <span className="text-destructive">{row.error}</span>}
              </div>
              {editing?.id === row.id ? (
                <div className="space-y-2">
                  <Input value={editing.subject} maxLength={200} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                  <Textarea rows={8} value={editing.bodyText} maxLength={4000} onChange={(e) => setEditing({ ...editing, bodyText: e.target.value })} />
                  <div className="flex gap-2"><Button size="sm" onClick={() => edit.mutate(editing)}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                </div>
              ) : (
                <>
                  <p className="font-semibold">{row.subject}</p>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{row.bodyText}</pre>
                  <p className="text-xs text-muted-foreground">The signature, design link, postal address and unsubscribe link are added when it is sent.</p>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {actionable && <Button size="sm" onClick={() => approve.mutate({ ids: [row.id] })}>Approve</Button>}
                {actionable && <Button size="sm" variant="outline" onClick={() => setEditing({ id: row.id, subject: row.subject, bodyText: row.bodyText })}>Edit</Button>}
                {(actionable || queueStatus === "approved") && <Button size="sm" variant="outline" onClick={() => reject.mutate({ ids: [row.id] })}>Reject</Button>}
                <Button size="sm" variant="ghost" onClick={() => test.mutate({ messageId: row.id })}>Email me a test copy</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function ContactsSection() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState("all");
  const list = trpc.crmOutreach.enrollments.useQuery(filter === "all" ? { limit: 100 } : { status: filter, limit: 100 });
  const setStatus = trpc.crmOutreach.setEnrollmentStatus.useMutation({ onSuccess: () => utils.crmOutreach.invalidate(), onError: (e) => toast.error(e.message) });
  const preview = trpc.crmOutreach.preview.useMutation({ onError: (e) => toast.error(e.message) });
  return (
    <Section title="Enrolled contacts" tip="afterQuote">
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-64 bg-white" aria-label="Contact status filter"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.entries(OUTREACH_ENROLLMENT_STATUS_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="max-h-80 overflow-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-left"><tr><th className="p-2">Contact</th><th className="p-2"><span className="inline-flex items-center gap-1">Status<OutreachTip id="replied" /></span></th><th className="p-2">Step</th><th className="p-2">Sent</th><th className="p-2">Next</th><th className="p-2"><span className="inline-flex items-center gap-1">CRM stage<OutreachTip id="moveCard" /></span></th><th className="p-2" /></tr></thead>
          <tbody>
            {(list.data ?? []).map((row: { id: number; dealId: number; email: string; contactName: string | null; status: string; currentStep: number; sentCount: number; nextSendAt: unknown; stage: string | null; stopReason: string | null }) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-2">{row.contactName ?? "—"}<br /><span className="text-muted-foreground">{row.email}</span></td>
                <td className="p-2">{OUTREACH_ENROLLMENT_STATUS_LABELS[row.status] ?? row.status}{row.stopReason ? <><br /><span className="text-muted-foreground">{row.stopReason}</span></> : null}</td>
                <td className="p-2">{row.currentStep + 1}</td>
                <td className="p-2">{row.sentCount}</td>
                <td className="p-2">{row.status === "active" ? when(row.nextSendAt) : "—"}</td>
                <td className="p-2">{row.stage ?? "—"}</td>
                <td className="p-2 space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => preview.mutate({ dealId: row.dealId, stepIndex: Math.min(row.currentStep, OUTREACH_CAP_LIMITS.maxSteps - 1) })}>Preview</Button>
                  {row.status === "active" && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: row.id, status: "paused" })}>Pause</Button>}
                  {(row.status === "paused" || row.status === "needs_owner" || row.status === "replied") && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: row.id, status: "active" })}>Resume</Button>}
                  {!["stopped", "unsubscribed", "bounced", "completed"].includes(row.status) && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: row.id, status: "stopped" })}>Stop</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.data && (
        <div className="rounded border border-border bg-muted/30 p-3 text-sm space-y-1" aria-live="polite">
          <p className="text-xs text-muted-foreground">Preview only · not saved · not sent · to {preview.data.to} · {preview.data.source === "ai" ? "AI draft" : "fixed template"}{preview.data.problems.length ? ` · AI notes: ${preview.data.problems.join("; ")}` : ""}</p>
          <p className="font-semibold">{preview.data.subject}</p>
          <pre className="whitespace-pre-wrap font-sans text-sm">{preview.data.text}</pre>
        </div>
      )}
    </Section>
  );
}

function SuppressionSection() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const list = trpc.crmOutreach.suppressions.useQuery({ limit: 100 });
  const add = trpc.crmOutreach.addSuppression.useMutation({ onSuccess: () => { setEmail(""); toast.success("Added. That address will never get outreach email."); utils.crmOutreach.invalidate(); }, onError: (e) => toast.error(e.message) });
  return (
    <Section title="Suppression list (never emailed)" tip="suppression">
      <div className="flex gap-2">
        <Input value={email} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} className="max-w-xs bg-white" aria-label="Email to suppress" />
        <Button variant="outline" disabled={!email.trim() || add.isPending} onClick={() => add.mutate({ email })}>Add</Button>
      </div>
      <ul className="max-h-48 overflow-auto text-xs space-y-0.5">
        {(list.data ?? []).map((row: { id: number; email: string; reason: string; createdAt: unknown }) => <li key={row.id}>{row.email} — {row.reason.replace("_", " ")} · {when(row.createdAt)}</li>)}
      </ul>
    </Section>
  );
}

function AuditSection() {
  const events = trpc.crmOutreach.events.useQuery({ limit: 100 });
  return (
    <Section title="Audit log (latest 100)">
      <ul className="max-h-64 overflow-auto text-xs space-y-0.5 font-mono">
        {(events.data ?? []).map((row: { id: number; eventType: string; email: string | null; createdAt: unknown; detail: unknown }) => (
          <li key={row.id}>{when(row.createdAt)} · {row.eventType}{row.email ? ` · ${row.email}` : ""}{row.detail ? ` · ${JSON.stringify(row.detail).slice(0, 160)}` : ""}</li>
        ))}
      </ul>
    </Section>
  );
}
