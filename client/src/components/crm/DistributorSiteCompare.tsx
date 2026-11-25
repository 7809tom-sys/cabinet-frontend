import { CABINETDEALZ_SITE_SNAPSHOT } from "@/lib/cabinetdealzSiteSnapshot";
import { compareWithCabinetdealz, parseDistributorSiteStats, type SiteComparison } from "@/lib/crmDistributorSiteStats";
import { isDistributorProspect } from "@/lib/crmDistributorFilter";
import { isCabinetShopProspect } from "@/lib/crmCabinetShopFilter";

type CompareDeal = { company?: string | null; notes?: string | null };

function Indicator({ result, diff }: { result: SiteComparison; diff?: number | null }) {
  if (result == null) return null;
  const amount = diff != null && diff !== 0 ? ` ${Math.abs(diff)}` : "";
  if (result === "ahead") return <span className="font-semibold text-emerald-700" title="Cabinetdealz is ahead" data-testid="crm-compare-ahead">▲{amount}</span>;
  if (result === "behind") return <span className="font-semibold text-red-600" title="Cabinetdealz is behind" data-testid="crm-compare-behind">▼{amount}</span>;
  return <span className="font-semibold text-slate-500" title="Even" data-testid="crm-compare-even">=</span>;
}

function needsLabel(value: boolean | null, rank: number | null) {
  if (value === true) return rank != null ? `needs new site (#${rank})` : "needs new site";
  if (value === false) return "not flagged";
  return "not assessed";
}

/**
 * Distributor prospect's own site stats from the notes, with a Cabinetdealz.com
 * comparison row underneath. Also used for cabinet shop prospects, whose
 * notes may not carry site stats yet ("not measured" / "not assessed").
 * Renders nothing for regular sales contacts.
 * Arrows sit on the Cabinetdealz row: ▲ ahead, ▼ behind, = even.
 */
export function DistributorSiteCompare({ deal }: { deal: CompareDeal }) {
  if (!isDistributorProspect(deal) && !isCabinetShopProspect(deal)) return null;
  const stats = parseDistributorSiteStats(deal.notes, deal.company);
  const compare = compareWithCabinetdealz(stats);
  const cd = CABINETDEALZ_SITE_SNAPSHOT;
  const mobileDiff = cd.mobilePageSpeed != null && stats.mobilePageSpeed != null ? cd.mobilePageSpeed - stats.mobilePageSpeed : null;
  return (
    <div className="mt-1 space-y-0.5 text-[10px] leading-snug text-muted-foreground" data-testid="crm-distributor-compare">
      <div data-testid="crm-compare-theirs">
        <span className="font-medium text-foreground">Their site:</span>{" "}
        Quality {stats.quality != null ? `${stats.quality}/10` : "not measured"} · Mobile {stats.mobilePageSpeed != null ? `${stats.mobilePageSpeed}/100` : "not measured"} · {stats.platform ?? "platform unknown"} · {needsLabel(stats.needsNewSite, stats.needsNewSiteRank)}
      </div>
      <div data-testid="crm-compare-cabinetdealz" title={`${cd.label} measured ${cd.measuredOn}: ${cd.source}. Desktop ${cd.desktopPageSpeed ?? "not measured"}/100.`}>
        <span className="font-medium text-foreground">{cd.label}:</span>{" "}
        Quality {cd.quality != null ? `${cd.quality}/10` : "not scored"} <Indicator result={compare.quality} /> · Mobile {cd.mobilePageSpeed != null ? `${cd.mobilePageSpeed}/100` : "not measured"} <Indicator result={compare.mobilePageSpeed} diff={mobileDiff} /> · {cd.platform ?? "platform unknown"} · {needsLabel(cd.needsNewSite, null)}
        <span className="block text-[9px]">measured {cd.measuredOn}</span>
      </div>
    </div>
  );
}
