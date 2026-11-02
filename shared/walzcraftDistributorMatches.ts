import type { DistributorDoorMatch } from "./walzcraftDistributorMatchTypes";
import { WALZCRAFT_DISTRIBUTOR_DOORS } from "./walzcraftDistributorMatchesData";

export type { DistributorDoorMatch, DistributorProfileMatch } from "./walzcraftDistributorMatchTypes";
export { WALZCRAFT_DISTRIBUTOR_DOORS };

export function doorDisplayName(d: DistributorDoorMatch): string {
  return d.doorName ?? `${d.code} (name not in source)`;
}

/** e.g. "Classic White (WalzCraft) · color match % not in source (estimated)" */
export function colorLabel(d: DistributorDoorMatch): string {
  if (!d.walzcraftColor) return "Color: no WalzCraft color mapped in source";
  const pct = d.colorMatchPct != null ? `${d.colorMatchPct}% color match` : "color match % not in source";
  return `Color: ${d.walzcraftColor} (WalzCraft) · ${pct}${d.colorEstimated ? " (estimated)" : ""}`;
}

export function rowText(d: DistributorDoorMatch): string {
  const top = d.matches[0];
  return `${d.distributor} · ${doorDisplayName(d)} → WalzCraft ${top.walzcraft} · ${top.confidencePct}% profile match · ${colorLabel(d)}`;
}

export type FeatureKey = "frame width" | "edge/bevel" | "panel";
export interface FeatureConfidence { feature: FeatureKey; pct: number | null; note: string }
const FEATURE_RE: Record<FeatureKey, RegExp> = {
  "frame width": /frame|width|stile/i,
  "edge/bevel": /edge|bevel|profile|step/i,
  panel: /panel|raise|construction|slab/i,
};
/** The CSVs carry no per-feature %, so pct is null; a feature listed in "unknowns" is flagged unpublished. */
export function featureConfidence(d: DistributorDoorMatch): FeatureConfidence[] {
  return (Object.keys(FEATURE_RE) as FeatureKey[]).map((feature) => {
    const hit = d.unknowns.find((u) => FEATURE_RE[feature].test(u));
    return { feature, pct: null, note: hit ? `unknown in source: ${hit}` : "not scored in source" };
  });
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Doors whose WalzCraft color equals the given shade name. */
export function doorsForShade(shadeName: string | null | undefined): DistributorDoorMatch[] {
  if (!shadeName) return [];
  return WALZCRAFT_DISTRIBUTOR_DOORS.filter((d) => norm(d.walzcraftColor).startsWith(norm(shadeName)) && norm(shadeName).length > 0);
}

/** Doors with a CSV match to a picker template (by templateId or by template name). */
export function doorsForTemplate(templateId: string | null | undefined, templateName?: string | null): DistributorDoorMatch[] {
  if (!templateId) return [];
  return WALZCRAFT_DISTRIBUTOR_DOORS.filter((d) =>
    d.matches.some((m) => m.templateId === templateId || (templateName ? norm(m.walzcraft).includes(norm(templateName)) : false)),
  );
}

/** Best "Seen at" match for a template, by that template's CSV confidence. */
export function profileConfidenceFor(d: DistributorDoorMatch, templateId: string, templateName?: string | null): number | null {
  const m = d.matches.find((x) => x.templateId === templateId || (templateName ? norm(x.walzcraft).includes(norm(templateName)) : false));
  return m ? m.confidencePct : null;
}

/** Candidate distributor doors for the current picker choice. */
export function candidateDoors(opts: { doorType: "slab" | "five-piece"; templateId: string | null; templateName?: string | null; shadeName?: string | null }): DistributorDoorMatch[] {
  let pool: DistributorDoorMatch[];
  if (opts.doorType === "slab") pool = WALZCRAFT_DISTRIBUTOR_DOORS.filter((d) => /slab/i.test(d.group));
  else if (opts.templateId) pool = doorsForTemplate(opts.templateId, opts.templateName);
  else return [];
  if (opts.shadeName) {
    const byColor = pool.filter((d) => norm(d.walzcraftColor).startsWith(norm(opts.shadeName)));
    if (byColor.length) return byColor;
  }
  return pool;
}

/** Match a CSV door to an existing featured style by distributor door name (no DB ids needed). */
export function doorForStyle(style: { ourName?: string | null; distributorName?: string | null; aliasName?: string | null }): DistributorDoorMatch | null {
  const names = [style.distributorName, style.ourName, style.aliasName].map(norm).filter(Boolean);
  return WALZCRAFT_DISTRIBUTOR_DOORS.find((d) => d.doorName && names.includes(norm(d.doorName))) ?? null;
}

export type ApprovalState = "approved" | "rejected";
export const APPROVAL_STORAGE_KEY = "walzcraftDoorMatchApprovals.v1";
export function readApprovals(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Record<string, ApprovalState> {
  try { return JSON.parse(storage?.getItem(APPROVAL_STORAGE_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
export function writeApproval(id: string, state: ApprovalState | null, storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage) {
  const all = readApprovals(storage);
  if (state) all[id] = state; else delete all[id];
  storage?.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(all));
  return all;
}
