import { TriangleAlert, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { missingPriceLineLabel } from "@/lib/designMissingPrice";

export type MissingPriceAlternative = {
  cabinetId: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  placementType: string | null;
  width: number;
  height: number;
  depth: number;
  hingeSide: string | null;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
  isCornerCabinet: boolean;
  cornerType: string | null;
  catalogImageUrl?: string | null;
  customerPrice: number;
  differences: string[];
};

function fmtIn(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${Math.round(value * 100) / 100}"`;
}

/**
 * Part 4: shown on a red-flagged (unpriced) cabinet. Lists up to three PRICED
 * same-family cabinets from the active line in rank order. Nothing is swapped
 * until the designer clicks Accept; Dismiss keeps the flag.
 */
export function DesignMissingPricePopover({
  masterCode,
  cabinetId,
  styleId,
  distributorId,
  tier,
  onAccept,
  onDismiss,
}: {
  masterCode: string;
  cabinetId: number;
  styleId: number;
  distributorId: number | null;
  tier: "homeowner" | "contractor" | "wholesale";
  onAccept: (alternative: MissingPriceAlternative) => void;
  onDismiss: () => void;
}) {
  const query = trpc.designMissingPrice.alternatives.useQuery(
    { masterCode, cabinetId: cabinetId > 0 ? cabinetId : undefined, styleId, distributorId: distributorId ?? undefined, tier, limit: 3 },
    { retry: false },
  );
  const alternatives = (query.data?.alternatives ?? []) as MissingPriceAlternative[];
  const family = query.data?.family?.family ?? null;
  return (
    <div data-testid="missing-price-popover" role="dialog" aria-label={`Priced alternatives for ${masterCode}`} className="w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-red-300 bg-white p-3 text-xs shadow-xl">
      <div className="mb-2 flex items-start gap-2">
        <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
          <TriangleAlert className="h-3 w-3" /> {missingPriceLineLabel(masterCode)}
        </span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="ml-auto rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><X className="h-3.5 w-3.5" /></button>
      </div>
      <p className="mb-2 text-[11px] text-slate-600">
        No price on the active line{family ? ` · searched the ${family.replace(/_/g, " ")} family` : ""}. Pick a priced alternative or dismiss to keep the flag.
      </p>
      {query.isLoading ? (
        <p className="py-3 text-center text-[11px] text-slate-500">Searching the active line…</p>
      ) : query.error ? (
        <p className="py-2 text-[11px] text-red-700">Could not load alternatives. <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></p>
      ) : alternatives.length === 0 ? (
        <p data-testid="missing-price-no-alternative" className="rounded border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-red-700">No priced alternative — catalog fix needed. This hit has been logged for the admin.</p>
      ) : (
        <ul className="space-y-1.5">
          {alternatives.map((alt, index) => (
            <li key={alt.cabinetId} data-testid="missing-price-alternative" className={`rounded border p-2 ${index === 0 ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] font-bold text-[#1a2744]">{alt.masterCode}</span>
                    {index === 0 && <span className="rounded bg-emerald-600 px-1 py-px text-[9px] font-bold uppercase text-white">Top match</span>}
                  </div>
                  <div className="truncate text-[11px] text-slate-700" title={alt.description ?? undefined}>{alt.description ?? ""}</div>
                  <div className="text-[10px] text-slate-500">{fmtIn(alt.width)} W × {fmtIn(alt.height)} H × {fmtIn(alt.depth)} D{alt.hingeSide ? ` · ${alt.hingeSide}` : ""}</div>
                  {alt.differences.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {alt.differences.map((difference) => (
                        <li key={difference} className="text-[10px] text-amber-800">• {difference}</li>
                      ))}
                    </ul>
                  )}
                  {alt.differences.length === 0 && <div className="mt-1 text-[10px] text-emerald-700">Same size and function.</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[13px] font-bold text-[#1a2744]">${alt.customerPrice.toFixed(2)}</span>
                  <Button type="button" size="sm" className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700" data-testid="missing-price-accept" onClick={() => onAccept(alt)}>
                    <Check className="h-3 w-3" /> Accept
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex justify-end">
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" data-testid="missing-price-dismiss" onClick={onDismiss}>Dismiss (keep flag)</Button>
      </div>
    </div>
  );
}
