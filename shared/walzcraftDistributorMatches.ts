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
  const top = d.matches?.[0];
  const profile = top ? `WalzCraft ${top.walzcraft} · ${top.confidencePct}% profile match` : "no WalzCraft profile match in source";
  return `${d.distributor} · ${doorDisplayName(d)} → ${profile} · ${colorLabel(d)}`;
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
    const hit = (d.unknowns ?? []).find((u) => FEATURE_RE[feature].test(u));
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

/** Canonical distributor key for a style's manufacturer/distributor label, or null when it is none of the four sheets. */
export function distributorKey(label: string | null | undefined): string | null {
  const n = norm(label);
  if (!n) return null;
  if (n.startsWith("faircrest")) return "Faircrest";
  if (n.startsWith("kitchencrest")) return "Kitchen Crest";
  if (n === "dl" || n.startsWith("dlcabinetry") || n.startsWith("dlcabinet")) return "DL Cabinetry";
  if (n.startsWith("altaeuro")) return "AltaEuro";
  return null;
}

export type StyleForMatch = {
  ourName?: string | null; distributorName?: string | null; aliasName?: string | null;
  supplierBrandName?: string | null; supplierName?: string | null; manufacturer?: string | null; distributor?: string | null;
  doorStyle?: string | null; sku?: string | null;
};

/**
 * Match a CSV door to a style: the distributor must match (from the style's supplier brand /
 * manufacturer / distributor field) AND the door name or code must match exactly. No
 * cross-distributor fallback — a shared color name like "Shaker White" never pulls another
 * distributor's door. Returns null ("No WalzCraft match yet") otherwise.
 */
export function doorForStyle(style: StyleForMatch): DistributorDoorMatch | null {
  const dist = [style.supplierBrandName, style.manufacturer, style.distributor, style.supplierName].map(distributorKey).find(Boolean) ?? null;
  if (!dist) return null;
  const names = [style.distributorName, style.ourName, style.aliasName, style.doorStyle, style.sku].map(norm).filter(Boolean);
  const pool = WALZCRAFT_DISTRIBUTOR_DOORS.filter((d) => d.distributor === dist);
  return pool.find((d) => d.doorName && names.includes(norm(d.doorName)))
    ?? pool.find((d) => names.includes(norm(d.code)))
    ?? null;
}

/** CSV doors sorted by distributor (A→Z), then door name, grouped with a heading per distributor. */
export function groupDoorsByDistributor(doors: DistributorDoorMatch[]): Array<{ distributor: string; doors: DistributorDoorMatch[] }> {
  const by = new Map<string, DistributorDoorMatch[]>();
  for (const d of doors) by.set(d.distributor, [...(by.get(d.distributor) ?? []), d]);
  return Array.from(by.keys()).sort((a, b) => a.localeCompare(b)).map((distributor) => ({
    distributor,
    doors: by.get(distributor)!.slice().sort((a, b) => doorDisplayName(a).localeCompare(doorDisplayName(b))),
  }));
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

/**
 * Default door to display when doorForStyle finds no exact match: the best-ranked CSV door,
 * scoped to the style's distributor when it is one of the four sheets (else all, grouped by
 * distributor A→Z). Ranked by shared name words (door name / code / color vs the style's
 * names), then by the door's top WalzCraft profile confidence. Nothing is invented: it is a
 * real sheet row, flagged `exact: false` so the UI labels it as a candidate.
 */
export function bestCandidateDoor(style: StyleForMatch): { door: DistributorDoorMatch; exact: boolean } | null {
  const exact = doorForStyle(style);
  if (exact) return { door: exact, exact: true };
  const dist = [style.supplierBrandName, style.manufacturer, style.distributor, style.supplierName].map(distributorKey).find(Boolean) ?? null;
  const scoped = dist ? WALZCRAFT_DISTRIBUTOR_DOORS.filter((d) => d.distributor === dist) : [];
  const pool = groupDoorsByDistributor(scoped.length ? scoped : WALZCRAFT_DISTRIBUTOR_DOORS).flatMap((g) => g.doors);
  if (!pool.length) return null;
  const words = (v: string | null | undefined) => String(v ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const styleWords = new Set([style.distributorName, style.ourName, style.aliasName, style.doorStyle, style.sku].flatMap(words));
  const top = (d: DistributorDoorMatch) => Math.max(0, ...(d.matches ?? []).map((m) => m.confidencePct ?? 0));
  const score = (d: DistributorDoorMatch) => new Set([...words(d.doorName), ...words(d.code), ...words(d.walzcraftColor)].filter((w) => styleWords.has(w))).size;
  let best = pool[0];
  for (const d of pool) if (score(d) > score(best) || (score(d) === score(best) && top(d) > top(best))) best = d;
  return { door: best, exact: false };
}
