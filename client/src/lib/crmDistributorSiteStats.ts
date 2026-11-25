/**
 * Reads a distributor prospect's own site stats from the CRM notes written by
 * the distributor master list import, e.g.
 *   NEEDS NEW SITE: yes, rank 7 of 33. Why: ...   (or "Needs new site: not flagged.")
 *   Platform: Wix
 *   Site quality: 5/10 | Mobile PageSpeed: 75/100
 * and compares them with the dated Cabinetdealz.com snapshot.
 */
import { CABINETDEALZ_SITE_SNAPSHOT } from "./cabinetdealzSiteSnapshot";

export type DistributorSiteStats = {
  quality: number | null;
  mobilePageSpeed: number | null;
  platform: string | null;
  needsNewSite: boolean | null;
  needsNewSiteRank: number | null;
};

export type SiteComparison = "ahead" | "behind" | "even" | null;

const QUALITY = /Site quality:\s*(\d{1,2})\s*\/\s*10/i;
const MOBILE = /Mobile PageSpeed:\s*(\d{1,3})\s*\/\s*100/i;
const PLATFORM = /(?:^|\n|\|)\s*Platform:\s*([^\n|]+)/i;
const NEEDS_YES = /NEEDS NEW SITE:\s*yes(?:,\s*rank\s*(\d+))?/i;
const NEEDS_NO = /Needs new site:\s*not flagged/i;

function bounded(raw: string | undefined, max: number): number | null {
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

export function parseDistributorSiteStats(
  notes: string | null | undefined,
  company?: string | null,
): DistributorSiteStats {
  const text = notes ?? "";
  const platformRaw = PLATFORM.exec(text)?.[1]?.trim() ?? "";
  const yes = NEEDS_YES.exec(text);
  let needsNewSite: boolean | null = null;
  if (yes) needsNewSite = true;
  else if (NEEDS_NO.test(text)) needsNewSite = false;
  else if (company != null && /needs new site/i.test(company)) needsNewSite = true;
  return {
    quality: bounded(QUALITY.exec(text)?.[1], 10),
    mobilePageSpeed: bounded(MOBILE.exec(text)?.[1], 100),
    platform: platformRaw && !/^not measured$/i.test(platformRaw) ? platformRaw : null,
    needsNewSite,
    needsNewSiteRank: yes?.[1] ? Number(yes[1]) : null,
  };
}

/** Is Cabinetdealz ahead, behind or even on a higher-is-better number? Null when either side is missing. */
export function compareHigherIsBetter(ours: number | null, theirs: number | null): SiteComparison {
  if (ours == null || theirs == null) return null;
  if (ours > theirs) return "ahead";
  if (ours < theirs) return "behind";
  return "even";
}

export function compareWithCabinetdealz(stats: DistributorSiteStats, snapshot = CABINETDEALZ_SITE_SNAPSHOT) {
  return {
    quality: compareHigherIsBetter(snapshot.quality, stats.quality),
    mobilePageSpeed: compareHigherIsBetter(snapshot.mobilePageSpeed, stats.mobilePageSpeed),
  };
}
