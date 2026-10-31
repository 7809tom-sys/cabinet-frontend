import { DLC_FR26_CATALOG, type DlcFr26CatalogEntry } from "./dlcFr26Catalog.generated";

/** DL Cabinetry's distributor id. Styles from other distributors are never mapped. */
export const DL_DISTRIBUTOR_ID = 450001;

/** Not mapped until Tom confirms what MC stands for. IMG.jpg (placeholder) is never in the catalog. */
export const DLC_UNMAPPED_SLUGS: ReadonlySet<string> = new Set(["mc"]);

/** DL's own style codes (DL-xx) to catalog slug. DL-MC and DL-CM have no mapping. */
const DL_STYLE_CODE_TO_SLUG: Record<string, string> = {
  "DL-CG": "cyber-grey",
  "DL-DC": "dark-caramel",
  "DL-DG": "dove-gray",
  "DL-DW": "driftwood",
  "DL-EWO": "ewo",
  "DL-GW": "glacier-white",
  "DL-PW": "pearl-white",
  "DL-VS": "versa-shaker",
};

/** Normalise a finish name: case, punctuation, Gray/Grey, Peccan/Pecan, Expresso/Espresso, EWO. */
export function normalizeFinishName(name: string | null | undefined): string {
  let s = (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  s = s
    .replace(/\bgray\b/g, "grey")
    .replace(/\bpeccan\b/g, "pecan")
    .replace(/\bexpresso\b/g, "espresso")
    .replace(/\bewo\b/g, "european white oak");
  return s.replace(/\s+/g, " ");
}

const BY_NAME: Map<string, DlcFr26CatalogEntry> = (() => {
  const map = new Map<string, DlcFr26CatalogEntry>();
  for (const entry of DLC_FR26_CATALOG) {
    if (DLC_UNMAPPED_SLUGS.has(entry.slug)) continue;
    for (const n of entry.names) map.set(normalizeFinishName(n), entry);
  }
  return map;
})();

const BY_SLUG = new Map(DLC_FR26_CATALOG.map((e) => [e.slug, e] as const));

export type DlcStyleInput = {
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  distributorId?: number | null;
};

export function isDlStyle(style: DlcStyleInput | null | undefined): boolean {
  if (!style) return false;
  if (style.distributorId === DL_DISTRIBUTOR_ID) return true;
  return /^DL-/i.test(style.styleCode?.trim() ?? "");
}

/** The DLC_FR26 finish for a DL door style, or null (the style then keeps today's behaviour). */
export function findDlcFinishForStyle(style: DlcStyleInput | null | undefined): DlcFr26CatalogEntry | null {
  if (!style || !isDlStyle(style)) return null;
  const code = style.styleCode?.trim().toUpperCase() ?? "";
  const bySlug = DL_STYLE_CODE_TO_SLUG[code];
  if (bySlug) {
    const e = BY_SLUG.get(bySlug);
    if (e && !DLC_UNMAPPED_SLUGS.has(e.slug)) return e;
  }
  for (const n of [style.ourName, style.aliasName]) {
    const hit = BY_NAME.get(normalizeFinishName(n));
    if (hit) return hit;
  }
  return null;
}
