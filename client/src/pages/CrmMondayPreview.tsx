import { useState } from "react";
import { CrmStageBoard } from "@/components/crm/monday/CrmStageBoard";
import { CrmTableView, type TableDeal } from "@/components/crm/monday/CrmTableView";
import { CrmPipelineTotals } from "@/components/crm/monday/CrmPipelineTotals";
import { CrmEmailWorkspaceView, type EmailConnectionRow, type EmailContact, type MailboxRow } from "@/components/crm/monday/CrmEmailWorkspace";
import { CrmDueBanner } from "@/components/crm/monday/CrmDealExtras";
import { summarizeAffiliatePipelines, type MondayDeal } from "@shared/crmMailbox";
import type { CrmPriority, CrmStage } from "@shared/crm";

const deals: (MondayDeal & { priority: CrmPriority; stage: CrmStage })[] = [
  { id: 1, title: "Rivera kitchen remodel", stage: "new", priority: "high", contactName: "J. Rivera", contactEmail: "rivera@example.com", company: "Rivera Homes", estimatedValue: "18400", nextFollowUpAt: "2026-10-25T15:00:00", affiliateId: null, updatedAt: "2026-10-24T12:00:00", ownerUserId: 1 },
  { id: 2, title: "Osprey bath quote", stage: "quoted", priority: "medium", contactName: "Ana Ruiz", contactEmail: "ana@example.com", company: null, estimatedValue: "9200", nextFollowUpAt: "2026-10-26T15:00:00", affiliateId: 7, updatedAt: "2026-10-26T09:00:00", ownerUserId: 2 },
  { id: 3, title: "Maple pantry", stage: "qualified", priority: "low", contactName: "Chris Hale", contactEmail: "chris@example.com", company: "Hale Builds", estimatedValue: "6400", nextFollowUpAt: "2026-11-02T15:00:00", affiliateId: 7, updatedAt: "2026-10-20T09:00:00", ownerUserId: 2 },
  { id: 4, title: "Won — lake house", stage: "won", priority: "medium", contactName: "Pat Nguyen", contactEmail: "pat@example.com", company: null, estimatedValue: "22100", nextFollowUpAt: null, affiliateId: null, updatedAt: "2026-10-18T09:00:00", ownerUserId: 1 },
];

const names = { 7: "Reaves Way Cabinet Shop" };
const tableDeals: TableDeal[] = deals.map((deal) => ({
  ...deal,
  ownerName: deal.ownerUserId === 1 ? "Cabinet Dealz" : "Reaves Way",
  lastActivityAt: deal.updatedAt,
}));
const contacts: EmailContact[] = deals.map((deal) => ({
  id: deal.id,
  title: deal.title,
  contactName: deal.contactName,
  contactEmail: deal.contactEmail,
  stage: deal.stage,
  estimatedValue: deal.estimatedValue,
}));
const mailbox: MailboxRow[] = [
  { kind: "sent", id: 1, dealId: 2, toEmail: "ana@example.com", subject: "Your quote is ready — Osprey bath quote", body: "Quote attached", at: "2026-10-26T10:00:00", title: "Osprey bath quote", stage: "quoted", contactName: "Ana Ruiz" },
  { kind: "draft", id: 2, dealId: 1, toEmail: "rivera@example.com", subject: "Following up on Rivera kitchen remodel", body: "<p>Hi J. Rivera,</p>", at: "2026-10-26T11:00:00", title: "Rivera kitchen remodel", stage: "new", contactName: "J. Rivera" },
];
const connections: EmailConnectionRow[] = [
  { affiliateId: 7, storeName: "Reaves Way Cabinet Shop", publicEmail: "hello@reavesway.example", connected: true, provider: "gmail", fromName: "Reaves Way", replyTo: "hello@reavesway.example", smtpUser: "hello@reavesway.example", enabled: true, hasPassword: true, lastTestOk: true },
  { affiliateId: 8, storeName: "Harbor Cabinets", publicEmail: "sales@harbor.example", connected: false, provider: null, fromName: "", replyTo: "sales@harbor.example", smtpUser: "", enabled: false, hasPassword: false, lastTestOk: null },
];

export default function CrmMondayPreview() {
  const [view, setView] = useState<"board" | "table" | "panel" | "email">("board");
  const [rows, setRows] = useState(deals);
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-[#c9a227]">Cabinet Dealz</p>
        <h1 className="text-2xl font-semibold text-[#1a2b4a]">Sales CRM</h1>
      </header>
      <div className="mb-4 flex gap-2">
        {(["board", "table", "panel", "email"] as const).map((item) => (
          <button key={item} className={`rounded-full px-3 py-1 text-sm ${view === item ? "bg-[#1a2b4a] text-white" : "bg-white"}`} onClick={() => setView(item)}>
            {item === "panel" ? "Item" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {view === "board" && (
        <>
          <CrmPipelineTotals totals={summarizeAffiliatePipelines(rows, names)} />
          <CrmStageBoard
            deals={rows}
            lang="en"
            onMove={(id, stage) => setRows((current) => current.map((deal) => deal.id === id ? { ...deal, stage } : deal))}
            onQuickAdd={(stage, title) => setRows((current) => [...current, { id: current.length + 10, title, stage, priority: "medium", contactName: title, contactEmail: null, company: null, estimatedValue: null, nextFollowUpAt: null, affiliateId: null, ownerUserId: 1 }])}
            renderCard={(deal) => (
              <article className={`rounded-lg border bg-white p-3 shadow-sm ${deal.nextFollowUpAt && new Date(deal.nextFollowUpAt) < new Date("2026-10-26") ? "ring-2 ring-red-400" : ""}`}>
                <div className="text-sm font-semibold text-[#1a2b4a]">{deal.contactName}</div>
                <div className="text-xs text-slate-600">{deal.title}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>{deal.affiliateId == null ? "Cabinet Dealz" : names[deal.affiliateId as 7]}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{deal.priority}</span>
                </div>
              </article>
            )}
          />
        </>
      )}
      {view === "table" && (
        <CrmTableView deals={tableDeals} lang="en" showAffiliate affiliateNames={names} onOpen={() => setView("panel")} onPatch={() => undefined} />
      )}
      {view === "panel" && (
        <aside className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="crm-item-panel">
          <h2 className="text-lg font-semibold text-[#1a2b4a]">Ana Ruiz</h2>
          <p className="text-xs text-slate-500">Osprey bath quote · Reaves Way Cabinet Shop</p>
          <CrmDueBanner nextFollowUpAt="2026-10-26T15:00:00" />
          <button className="rounded-md border px-3 py-1.5 text-sm">Compose email</button>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500">Updates</h3>
            <p className="mt-1 text-sm">Quote ready to send. Customer asked about the maple finish.</p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500">Files</h3>
            <a className="text-sm text-[#1a2b4a] underline" href="#quote">Osprey-bath-quote.pdf</a>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500">Activity</h3>
            <p className="text-xs text-slate-500">Oct 26 · email</p>
            <p className="text-sm">Email sent to ana@example.com — Your quote is ready</p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500">Linked customer / designs / quotes</h3>
            <p className="text-sm">Ana Ruiz · ana@example.com</p>
            <p className="text-sm">Design: Osprey primary bath</p>
            <p className="text-sm">Quote: $9,200</p>
          </section>
        </aside>
      )}
      {view === "email" && (
        <CrmEmailWorkspaceView
          audience="affiliate"
          contacts={contacts}
          mailbox={mailbox}
          templates={[]}
          settings={null}
          connections={connections}
          setupInitiallyOpen
          prefill={{ dealId: 2, to: "ana@example.com", contactName: "Ana Ruiz", dealTitle: "Osprey bath quote", designLink: "https://cabinetdealz.com/design/12", quoteLink: "https://cabinetdealz.com/design/12" }}
          onSend={async () => undefined}
          onSaveDraft={async () => undefined}
          onDeleteDraft={async () => undefined}
          onSaveSetup={async () => undefined}
          onTestSetup={async () => undefined}
          onSaveTemplate={async () => undefined}
          onDeleteTemplate={async () => undefined}
        />
      )}
    </main>
  );
}
