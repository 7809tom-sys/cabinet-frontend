/**
 * Right-click attributes add-ons for a straight base cabinet.
 *
 * Tom: on every base that is not a drawer base and not a corner base
 * (lazy Susan LSB/ERB, blind corner, corner drawer, economy corner, and the
 * other corner families) and is 21 inches or wider, the cabinet attributes
 * menu can add roll-out trays and can open the sink and faucet picker.
 *
 * Tray SKUs are read from the catalog rows the caller already has. Nothing
 * here invents a code or a price. The live designer asks the same-line
 * resolver (`resolveRollOutTray`) and this lookup is the rule that tests lock
 * against the committed catalog.
 */
export const MIN_BASE_ATTRIBUTE_ADDON_WIDTH_IN = 21;

/** Published face height of the universal UNIV-ROT tray rows in the catalog. */
export const UNIVERSAL_ROLLOUT_TRAY_HEIGHT_IN = 2.25;

/** Toe kick the base box gives up before the tray opening starts. Matches STD.TOE_KICK. */
export const ROLLOUT_TOE_KICK_IN = 4.5;
/** Top rail / stretcher above the tray opening. */
export const ROLLOUT_TOP_RAIL_IN = 0.75;
/** One top drawer bank on a standard base. Full-height bases pass 0 drawers. */
export const ROLLOUT_TOP_DRAWER_IN = 6;
/**
 * Room above the tray face so the next tray can still be pulled.
 * 2.25" tray + 3.75" clearance = 6" of opening per tray, which is 3 trays
 * in a 34.5" base that already has a top drawer.
 */
export const ROLLOUT_TRAY_USE_CLEARANCE_IN = 3.75;

const STORED_CORNER_TYPES = new Set([
  "blind-corner",
  "l-shape",
  "diagonal",
  "pie-cut",
  "lazy-susan",
  "easy-reach",
]);

export type BaseCabinetAddOnTarget = {
  placement?: string | null;
  category?: string | null;
  subCategory?: string | null;
  masterCode?: string | null;
  description?: string | null;
  isCornerCabinet?: boolean | null;
  cornerType?: string | null;
  nominalWidth?: number | null;
  width?: number | null;
  height?: number | null;
  numberOfDrawers?: number | null;
};

export type CatalogTraySource = {
  code?: string | null;
  sku?: string | null;
  masterCode?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  kind?: string | null;
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  lineId?: string | number | null;
  styleId?: number | null;
};

export type TrayLookupMatch = {
  ok: true;
  sku: string;
  /** Cabinet opening this tray is built for, in inches. */
  width: number;
  height: number | null;
  description: string | null;
};

export type TrayLookupMiss = {
  ok: false;
  reason: string;
};

export type TrayLookupResult = TrayLookupMatch | TrayLookupMiss;

export function cabinetNominalWidthIn(cabinet: {
  nominalWidth?: number | null;
  width?: number | null;
}): number {
  if (typeof cabinet.nominalWidth === "number" && cabinet.nominalWidth > 0) return cabinet.nominalWidth;
  const live = typeof cabinet.width === "number" ? cabinet.width : Number(cabinet.width);
  return Number.isFinite(live) && live > 0 ? live : 0;
}

function normalizedCode(masterCode: string | null | undefined): string {
  return (masterCode ?? "").toUpperCase().replace(/[\s_]/g, "");
}

/** A plain straight base (B24, SB36, DB18, 3DB24). Never a corner cabinet. */
export function isPlainStraightBaseCode(masterCode: string | null | undefined): boolean {
  return /^(?:B|SB|DB|3DB)-?\d/.test(normalizedCode(masterCode));
}

/**
 * Drawer base: DB / 2DB / 3DB / 4DB, or a catalog row whose text says
 * "drawer base". A standard base with one door and one drawer is not a drawer base.
 */
export function isDrawerBaseCabinet(cabinet: {
  masterCode?: string | null;
  subCategory?: string | null;
  description?: string | null;
  category?: string | null;
}): boolean {
  const code = normalizedCode(cabinet.masterCode);
  if (/^(?:\d+)?DB-?\d/.test(code)) return true;
  const text = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""} ${cabinet.category ?? ""}`.toLowerCase();
  return /\bdrawers?\s+bases?\b/.test(text);
}

/**
 * Corner bases the attributes add-ons must skip: lazy Susan (LS/LSB/LZS),
 * easy reach (ER/ERB/BER), blind corner (BBC/BCB/BLB), corner drawer (CDB),
 * diagonal and economy-corner cabinets, plus a stored corner type.
 * A plain B/SB code stays a straight base even if a flag was set on it.
 */
export function isCornerBaseCabinet(cabinet: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  isCornerCabinet?: boolean | null;
  cornerType?: string | null;
}): boolean {
  const code = normalizedCode(cabinet.masterCode);
  if (isPlainStraightBaseCode(code)) return false;
  const sub = (cabinet.subCategory ?? "").toLowerCase();
  const desc = (cabinet.description ?? "").toLowerCase();
  if (/economy corner|economic corner/.test(`${sub} ${desc}`)) return true;
  if (
    /^(?:BBC|WBC|BBL|BBR|WBL|WBR|BLB|BCB|LSB?|LZS|LS|CSB|WLS|DCW|DCB|DCSB|CDB|ERB?|BER|WER|WDC|KWD|AG-|AG\d|CAG)/.test(code)
    || /-CNR|CORNER/.test(code)
  ) {
    return true;
  }
  if (/corner|lazy susan|easy reach|easy-reach|blind/.test(sub)) return true;
  if (cabinet.isCornerCabinet) return true;
  const cornerType = cabinet.cornerType == null ? "" : String(cabinet.cornerType);
  return STORED_CORNER_TYPES.has(cornerType);
}

/** True for the bases that show Add roll-out tray and Add sink & faucet. */
export function isBaseCabinetAttributeAddOnEligible(cabinet: BaseCabinetAddOnTarget): boolean {
  const placement = (cabinet.placement ?? "").toLowerCase();
  if (placement !== "base") return false;
  if (isDrawerBaseCabinet(cabinet)) return false;
  if (isCornerBaseCabinet(cabinet)) return false;
  const code = normalizedCode(cabinet.masterCode);
  if (/^(?:UNIV-ROT|RS-?\d|ROT-?\d|RO-?\d)/.test(code)) return false;
  const kind = `${cabinet.category ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
  if (/\bfiller\b|\bpanel\b|\bskin\b|moulding|molding/.test(kind)) return false;
  return cabinetNominalWidthIn(cabinet) + 1e-9 >= MIN_BASE_ATTRIBUTE_ADDON_WIDTH_IN;
}

export function traySourceCode(row: CatalogTraySource): string {
  return (row.code ?? row.sku ?? row.masterCode ?? "").trim();
}

/** A catalog accessory that is a roll-out tray or roll-out shelf, not a cabinet kit. */
export function isRollOutTrayAccessory(row: CatalogTraySource): boolean {
  if (row.kind && row.kind !== "accessory") return false;
  const code = traySourceCode(row);
  const text = `${row.subCategory ?? ""} ${row.category ?? ""} ${row.description ?? ""} ${row.name ?? ""}`;
  if (/lazy susan/i.test(text)) return false;
  if (/^(?:UNIV-ROT|RS-?\d|ROT-?\d|RO-?\d)/i.test(code)) return true;
  return /roll-?out\s+(?:tray|shelf)|rollout\s+tray|pull-?out\s+tray/i.test(text);
}

/** The cabinet opening a tray SKU is built for (UNIV-ROT24 and RS24-TYPEA are both 24). */
export function trayNominalWidthIn(row: CatalogTraySource): number | null {
  const code = traySourceCode(row);
  const coded = code.match(/(?:UNIV-ROT|RS-?|ROT-?|RO-?)(\d{2})(?!\d)/i);
  if (coded) return Number(coded[1]);
  const desc = `${row.description ?? ""} ${row.name ?? ""}`;
  const forCabinet = desc.match(/for\s+(?:an?\s+)?(\d+(?:\.\d+)?)\s*(?:["”]|-?\s*inch|\s*in\b)/i);
  if (forCabinet) return Number(forCabinet[1]);
  const width = row.widthIn ?? row.width;
  if (typeof width === "number" && width > 0) return width;
  return null;
}

/** Face height published on the tray row, when the catalog states one. */
export function catalogTrayHeightIn(row: CatalogTraySource | null | undefined): number | null {
  if (!row) return null;
  const direct = row.heightIn ?? row.height;
  if (typeof direct === "number" && direct > 0 && direct < 12) return direct;
  const desc = `${row.description ?? ""} ${row.name ?? ""}`;
  const words = desc.match(/height\s+(\d+)(?:\s+(\d+)\s*\/\s*(\d+))?/i);
  if (words) {
    const whole = Number(words[1]);
    const fraction = words[2] && words[3] ? Number(words[2]) / Number(words[3]) : 0;
    const height = whole + fraction;
    return height > 0 && height < 12 ? height : null;
  }
  const marked = desc.match(/(\d+)(?:\s*-\s*(\d+)\s*\/\s*(\d+))?\s*"?\s*H\b/);
  if (!marked) return null;
  const whole = Number(marked[1]);
  const fraction = marked[2] && marked[3] ? Number(marked[2]) / Number(marked[3]) : 0;
  const height = whole + fraction;
  return height > 0 && height < 12 ? height : null;
}

function trayPreference(row: CatalogTraySource): number {
  const code = traySourceCode(row).toUpperCase();
  const text = `${row.subCategory ?? ""} ${row.category ?? ""} ${row.description ?? ""} ${row.name ?? ""}`.toLowerCase();
  if (code.startsWith("UNIV-ROT") || code.startsWith("ROT") || /rollout tray|roll-out tray|pull-?out tray/.test(text)) return 3;
  if (code.startsWith("RS") || /roll-?out shelf|rollout shelf/.test(text)) return 2;
  return 1;
}

/**
 * How many trays fit in this base.
 * Usable opening is cabinet height minus the toe kick, the top rail, and one
 * drawer bank when the base has drawers. Each tray needs its own face height
 * plus clearance. A 34.5" one-drawer base fits 3 universal trays.
 */
export function maxRollOutTraysForCabinet(input: {
  height?: number | null;
  numberOfDrawers?: number | null;
  trayHeightIn?: number | null;
}): number {
  const height = typeof input.height === "number" && input.height > 0 ? input.height : 34.5;
  const trayHeight = typeof input.trayHeightIn === "number" && input.trayHeightIn > 0
    ? input.trayHeightIn
    : UNIVERSAL_ROLLOUT_TRAY_HEIGHT_IN;
  const drawerBank = input.numberOfDrawers === 0 ? 0 : ROLLOUT_TOP_DRAWER_IN;
  const usable = height - ROLLOUT_TOE_KICK_IN - ROLLOUT_TOP_RAIL_IN - drawerBank;
  if (usable + 1e-9 < trayHeight) return 0;
  const pitch = trayHeight + ROLLOUT_TRAY_USE_CLEARANCE_IN;
  return Math.max(0, Math.min(5, Math.floor((usable + 1e-9) / pitch)));
}

/**
 * Pick the roll-out tray SKU from this cabinet's line.
 * Exact opening width wins. If the line has both a universal tray and a
 * roll-out shelf for that opening, the tray SKU is used. Otherwise the largest
 * tray that still fits is used. A line with no fitting tray returns a reason
 * the button can show.
 */
export function lookupRollOutTraySku(
  cabinet: { nominalWidth?: number | null; width?: number | null; lineId?: string | number | null; styleId?: number | null },
  rows: readonly CatalogTraySource[],
): TrayLookupResult {
  const cabinetWidth = cabinetNominalWidthIn(cabinet);
  const trays = rows.filter(isRollOutTrayAccessory);
  const wantsStyle = cabinet.styleId != null;
  const wantsLine = cabinet.lineId != null && String(cabinet.lineId) !== "";
  const scoped = trays.filter((row) => {
    if (wantsStyle) return row.styleId != null && row.styleId === cabinet.styleId;
    if (wantsLine) return row.lineId != null && String(row.lineId) === String(cabinet.lineId);
    return true;
  });
  if (scoped.length === 0) {
    return { ok: false, reason: "This cabinet line has no roll-out tray SKU." };
  }
  let best: { row: CatalogTraySource; width: number; rank: number } | null = null;
  for (const row of scoped) {
    const width = trayNominalWidthIn(row);
    if (width == null || !(width > 0) || width > cabinetWidth + 0.25) continue;
    const exact = Math.abs(width - cabinetWidth) <= 0.25;
    const rank = (exact ? 1000 : width) * 10 + trayPreference(row);
    if (best == null || rank > best.rank) best = { row, width, rank };
  }
  if (!best) {
    const shown = Number.isFinite(cabinetWidth) ? Math.round(cabinetWidth) : 0;
    return { ok: false, reason: `No roll-out tray in this line fits a ${shown}" cabinet.` };
  }
  return {
    ok: true,
    sku: traySourceCode(best.row),
    width: best.width,
    height: catalogTrayHeightIn(best.row),
    description: best.row.description ?? best.row.name ?? null,
  };
}
