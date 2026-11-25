/**
 * Dated snapshot of cabinetdealz.com's own site stats, shown beside each
 * distributor prospect's stats in the Sales CRM. Update by re-measuring and
 * editing the values and the date here; nothing else needs to change.
 *
 * Measured Nov 25, 2026, 9:49-9:51 AM CT, on https://www.cabinetdealz.com/:
 * - PageSpeed: Lighthouse 13.6.0 performance score, median of 3 runs each.
 *   Mobile runs 83 / 93 / 93, desktop runs 99 / 99 / 99. The public PageSpeed
 *   Insights API was over its daily anonymous quota, so these are local
 *   Lighthouse runs with its default mobile and desktop presets (the same
 *   engine PageSpeed Insights uses, but not run on Google's servers).
 * - Platform: homepage serves a Vite-hashed module bundle into a React root,
 *   hosted on Vercel; this repo is the React/Vite app.
 * - Quality: the master list's 1-10 score is a subjective rubric with no
 *   written criteria, so it is not scored here rather than guessed.
 * - Needs new site: the master list's flag was assigned per distributor with
 *   no written threshold, so it is not assessed for our own site.
 */
export const CABINETDEALZ_SITE_SNAPSHOT = {
  label: "Cabinetdealz.com",
  measuredOn: "Nov 25, 2026",
  mobilePageSpeed: 93 as number | null,
  desktopPageSpeed: 99 as number | null,
  platform: "Custom (React/Vite)" as string | null,
  quality: null as number | null,
  needsNewSite: null as boolean | null,
  source: "Lighthouse 13.6.0, median of 3 local runs (PageSpeed Insights API quota was exhausted)",
} as const;

export type CabinetdealzSiteSnapshot = typeof CABINETDEALZ_SITE_SNAPSHOT;
