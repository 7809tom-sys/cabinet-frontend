import type { AffiliatePipelineTotal } from "@shared/crmMailbox";

function money(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function CrmPipelineTotals({ totals }: { totals: AffiliatePipelineTotal[] }) {
  if (totals.length === 0) return null;
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="crm-pipeline-totals">
      {totals.map((row) => (
        <div key={row.affiliateId ?? "house"} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="truncate text-xs font-semibold text-[#1a2b4a]">{row.name}</div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-slate-600">
            <span>{row.openCount} open · {money(row.openValue)}</span>
            <span className="text-emerald-700">{row.wonCount} won</span>
          </div>
        </div>
      ))}
    </div>
  );
}
