import { useState } from "react";
import { CRM_PRIORITIES, CRM_PRIORITY_LABELS, CRM_STAGES, CRM_STAGE_LABELS, type CrmPriority, type CrmStage } from "@shared/crm";
import { CRM_STAGE_COLORS, crmDueState, type MondayDeal } from "@shared/crmMailbox";

type Lang = "en" | "es";

export type TableDeal = MondayDeal & {
  ownerName?: string | null;
  lastActivityAt?: Date | string | null;
};

function money(value: string | number | null | undefined) {
  if (value == null || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function CrmTableView({
  deals,
  lang,
  showAffiliate,
  affiliateNames,
  onOpen,
  onPatch,
}: {
  deals: TableDeal[];
  lang: Lang;
  showAffiliate: boolean;
  affiliateNames?: Record<number, string>;
  onOpen: (id: number) => void;
  onPatch: (id: number, patch: { title?: string; stage?: CrmStage; priority?: CrmPriority; estimatedValue?: number | null; nextFollowUpAt?: number | null }) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white" data-testid="crm-table-view">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-[#1a2b4a] text-left text-xs uppercase tracking-wide text-white">
          <tr>
            <th className="px-3 py-2">Deal</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Owner</th>
            {showAffiliate && <th className="px-3 py-2">Affiliate</th>}
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {deals.length === 0 ? (
            <tr><td colSpan={showAffiliate ? 8 : 7} className="px-3 py-8 text-center text-slate-500">No deals match this view.</td></tr>
          ) : deals.map((deal) => (
            <CrmTableRow key={deal.id} deal={deal} lang={lang} showAffiliate={showAffiliate} affiliateNames={affiliateNames} onOpen={onOpen} onPatch={onPatch} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrmTableRow({
  deal,
  lang,
  showAffiliate,
  affiliateNames,
  onOpen,
  onPatch,
}: {
  deal: TableDeal;
  lang: Lang;
  showAffiliate: boolean;
  affiliateNames?: Record<number, string>;
  onOpen: (id: number) => void;
  onPatch: (id: number, patch: { title?: string; stage?: CrmStage; priority?: CrmPriority; estimatedValue?: number | null; nextFollowUpAt?: number | null }) => void;
}) {
  const due = crmDueState(deal.nextFollowUpAt);
  const dueClass = due === "overdue" ? "bg-red-50 text-red-700" : due === "today" ? "bg-amber-50 text-amber-800" : "";
  return (
    <tr className={`border-t border-slate-100 ${dueClass}`}>
      <td className="px-3 py-2">
        <button className="text-left font-medium text-[#1a2b4a] hover:underline" onClick={() => onOpen(deal.id)}>{deal.contactName || deal.title}</button>
        <InlineText value={deal.title} label="Deal title" onCommit={(title) => onPatch(deal.id, { title })} />
      </td>
      <td className="px-3 py-2">
        <select
          aria-label="Status"
          className="rounded-full px-2 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: CRM_STAGE_COLORS[deal.stage] }}
          value={deal.stage}
          onChange={(event) => onPatch(deal.id, { stage: event.target.value as CrmStage })}
        >
          {CRM_STAGES.map((stage) => <option key={stage} value={stage}>{CRM_STAGE_LABELS[stage][lang]}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1a2b4a] text-[10px] font-semibold text-white" title={deal.ownerName || "Unassigned"}>
          {initials(deal.ownerName)}
        </span>
      </td>
      {showAffiliate && (
        <td className="px-3 py-2 text-xs">{deal.affiliateId == null ? "Cabinet Dealz" : affiliateNames?.[deal.affiliateId] ?? `#${deal.affiliateId}`}</td>
      )}
      <td className="px-3 py-2">
        <input
          aria-label="Due date"
          type="date"
          className="rounded border border-slate-200 px-1 py-0.5 text-xs"
          value={deal.nextFollowUpAt ? new Date(deal.nextFollowUpAt).toISOString().slice(0, 10) : ""}
          onChange={(event) => onPatch(deal.id, { nextFollowUpAt: event.target.value ? new Date(`${event.target.value}T12:00:00`).getTime() : null })}
        />
        {due === "overdue" && <div className="text-[10px] font-semibold text-red-700">Overdue</div>}
        {due === "today" && <div className="text-[10px] font-semibold text-amber-700">Due today</div>}
      </td>
      <td className="px-3 py-2">
        <InlineText
          value={deal.estimatedValue == null ? "" : String(deal.estimatedValue)}
          label="Value"
          display={money(deal.estimatedValue) || "—"}
          onCommit={(value) => onPatch(deal.id, { estimatedValue: value.trim() ? Number(value) : null })}
        />
      </td>
      <td className="px-3 py-2">
        <select
          aria-label="Priority"
          className={`rounded-full px-2 py-1 text-xs font-medium ${deal.priority === "high" ? "bg-red-100 text-red-700" : deal.priority === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}
          value={deal.priority}
          onChange={(event) => onPatch(deal.id, { priority: event.target.value as CrmPriority })}
        >
          {CRM_PRIORITIES.map((priority) => <option key={priority} value={priority}>{CRM_PRIORITY_LABELS[priority][lang]}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-xs text-slate-500">{deal.lastActivityAt ? new Date(deal.lastActivityAt).toLocaleString() : deal.updatedAt ? new Date(deal.updatedAt).toLocaleDateString() : "—"}</td>
    </tr>
  );
}

function InlineText({ value, label, display, onCommit }: { value: string; label: string; display?: string; onCommit: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button className="block max-w-[220px] truncate text-left text-xs text-slate-600 hover:text-[#1a2b4a]" aria-label={label} onClick={() => { setDraft(value); setEditing(true); }}>
        {display ?? value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label={label}
      className="w-full rounded border border-[#c9a227] px-1 py-0.5 text-xs"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onCommit(draft); }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        if (event.key === "Escape") setEditing(false);
      }}
    />
  );
}
