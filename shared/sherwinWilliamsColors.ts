/**
 * Small Sherwin-Williams reference table for door-style swatches.
 *
 * Hex values are the HEX attribute published on sherwin-williams.com color
 * pages (confirmed from the page data, not a third-party palette):
 *   SW 7005 Pure White  #EDECE6  https://www.sherwin-williams.com/sherwinwilliams/SW7005-pure-white
 *   SW 7015 Repose Gray #CCC9C0  https://www.sherwin-williams.com/sherwinwilliams/SW7015-reposegray
 *   SW 7069 Iron Ore    #434341  https://www.sherwin-williams.com/sherwinwilliams/SW7069-iron-ore
 * CIE L*a*b* is not published on those pages. It is computed from the
 * published sRGB hex with the D65 / 2° conversion in `ciede2000.ts`.
 * Colors outside this table use the admin eyedropper on the distributor photo.
 */
import { labFromHex, type Lab } from "./ciede2000";

export type SherwinWilliamsColor = {
  code: string;
  name: string;
  hex: string;
  lab: Lab;
  source: string;
};

const PUBLISHED: ReadonlyArray<{ code: string; name: string; hex: string; source: string }> = [
  {
    code: "SW7005",
    name: "Pure White",
    hex: "#edece6",
    source: "https://www.sherwin-williams.com/sherwinwilliams/SW7005-pure-white",
  },
  {
    code: "SW7015",
    name: "Repose Gray",
    hex: "#ccc9c0",
    source: "https://www.sherwin-williams.com/sherwinwilliams/SW7015-reposegray",
  },
  {
    code: "SW7069",
    name: "Iron Ore",
    hex: "#434341",
    source: "https://www.sherwin-williams.com/sherwinwilliams/SW7069-iron-ore",
  },
];

export const SHERWIN_WILLIAMS_COLORS: readonly SherwinWilliamsColor[] = PUBLISHED.flatMap((row) => {
  const lab = labFromHex(row.hex);
  return lab ? [{ ...row, lab }] : [];
});

export function normalizeSherwinWilliamsCode(value: string | null | undefined): string | null {
  const compact = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
  if (!compact) return null;
  const match = /^(?:SW)?(\d{4})$/.exec(compact);
  return match ? `SW${match[1]}` : null;
}

export function sherwinWilliamsColor(code: string | null | undefined): SherwinWilliamsColor | null {
  const normalized = normalizeSherwinWilliamsCode(code);
  if (!normalized) return null;
  return SHERWIN_WILLIAMS_COLORS.find((row) => row.code === normalized) ?? null;
}
