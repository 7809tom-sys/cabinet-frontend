// ─── Vendor "upload by code" ────────────────────────────────────────────────
// A vendor sends a sheet with three things per row: a nomenclature code (a
// master code OR any alias for it), the name of the door, and a price. Nothing
// else is required. This module is pure (no DB, no IO) so the preview the
// vendor sees and the commit that follows are produced by the same planner.
//
// Rules, in order of authority:
//   1. A code that equals a master code, or is a known alias of exactly one
//      master (sku / vendorSku / altSku / sku_master_aliases / cabinet_aliases /
//      two-way equivalences / saved code aliases), attaches to that master.
//   2. A code that matches nothing becomes a NEW master automatically. It is
//      created hidden from customers and the Designer (no dimensions are
//      invented) and its SKU waits as pending until an administrator approves.
//   3. A code that matches more than one master is never guessed: the row is
//      reported for administrator review.
//   4. The door name must identify exactly one active door style on the line
//      (our name, public name, the vendor's own name or the style code).
import { normalizeCode } from "./cabinetCodeMatch";

export const MAX_UPLOAD_ROWS = 2000;
export const MAX_PRICE = 10_000_000;

// ─── Parsing ────────────────────────────────────────────────────────────────

export interface UploadRow {
  /** 1-based row number as the vendor sees it in their sheet. */
  rowNumber: number;
  code: string;
  door: string;
  /** Source price. Stored as the list price. */
  price?: number;
  /** Optional separate cost column. */
  cost?: number;
}

export interface InvalidUploadRow {
  rowNumber: number;
  message: string;
  raw: string[];
}

export interface ParsedUpload {
  rows: UploadRow[];
  invalid: InvalidUploadRow[];
  headerDetected: boolean;
  notes: string[];
}

/** Split pasted / CSV text into a grid. Quote-aware; tab or comma delimited. */
export function splitDelimited(text: string): string[][] {
  const src = (text ?? "").replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(",") ? "," : firstLine.includes(";") ? ";" : ",";
  const grid: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(cell); cell = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      grid.push(row); row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); grid.push(row); }
  return grid;
}

const HEADER_WORDS = {
  code: ["code", "nomenclature", "sku", "item", "itemcode", "itemnumber", "itemno", "partnumber", "partno", "part", "cabinet", "cabinetcode", "model", "mastercode", "alias", "vendorsku", "distributorsku", "productcode", "product"],
  door: ["door", "doorname", "doorstyle", "style", "stylename", "doorcolor", "doorfinish", "finish", "color", "colour", "line"],
  price: ["price", "listprice", "list", "msrp", "unitprice", "sellprice", "sell", "retail"],
  cost: ["cost", "yourcost", "wholesale", "wholesaleprice", "net", "netprice", "dealercost"],
} as const;

function headerKey(cell: string): string {
  return (cell ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parse "$1,234.50", "12", "12.5 " → number. Returns null if it is not a usable price. */
export function parsePrice(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 && value <= MAX_PRICE ? Math.round(value * 100) / 100 : null;
  const cleaned = value.replace(/[\s$,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 && n <= MAX_PRICE ? Math.round(n * 100) / 100 : null;
}

export function parseUploadGrid(grid: string[][]): ParsedUpload {
  const notes: string[] = [];
  const cleanGrid = grid.map((r) => r.map((c) => String(c ?? "").trim()));
  const firstNonEmpty = cleanGrid.findIndex((r) => r.some((c) => c !== ""));
  if (firstNonEmpty === -1) return { rows: [], invalid: [], headerDetected: false, notes };

  const first = cleanGrid[firstNonEmpty];
  const idx: { code: number; door: number; price: number; cost: number } = { code: -1, door: -1, price: -1, cost: -1 };
  first.forEach((cell, i) => {
    const key = headerKey(cell);
    if (!key) return;
    for (const field of ["code", "door", "price", "cost"] as const) {
      if (idx[field] === -1 && (HEADER_WORDS[field] as readonly string[]).includes(key)) { idx[field] = i; return; }
    }
  });
  const recognized = Object.values(idx).filter((v) => v !== -1).length;
  let headerDetected = recognized >= 2;
  let dataStart = firstNonEmpty + (headerDetected ? 1 : 0);

  if (!headerDetected) {
    // No recognisable header: Code, Door, Price in the first three columns.
    idx.code = 0; idx.door = 1; idx.price = 2; idx.cost = -1;
    // A first row whose third cell is not a price is a header we could not read.
    if (first.length >= 3 && first[2] !== "" && parsePrice(first[2]) == null) {
      headerDetected = true;
      dataStart = firstNonEmpty + 1;
      notes.push("The first row was treated as a header and skipped.");
    } else {
      notes.push("No header row found - columns were read as Code, Door, Price.");
    }
  } else if (idx.code === -1 || idx.door === -1 || (idx.price === -1 && idx.cost === -1)) {
    const missing = [idx.code === -1 ? "Code" : "", idx.door === -1 ? "Door" : "", idx.price === -1 && idx.cost === -1 ? "Price" : ""].filter(Boolean);
    return {
      rows: [],
      invalid: [{ rowNumber: firstNonEmpty + 1, message: `Header row is missing a ${missing.join(" / ")} column.`, raw: first }],
      headerDetected: true,
      notes,
    };
  }

  const rows: UploadRow[] = [];
  const invalid: InvalidUploadRow[] = [];
  for (let r = dataStart; r < cleanGrid.length; r += 1) {
    const cells = cleanGrid[r];
    if (!cells.some((c) => c !== "")) continue;
    const rowNumber = r + 1;
    const code = (cells[idx.code] ?? "").trim();
    const door = (cells[idx.door] ?? "").trim();
    const rawPrice = idx.price >= 0 ? cells[idx.price] ?? "" : "";
    const rawCost = idx.cost >= 0 ? cells[idx.cost] ?? "" : "";
    const price = rawPrice ? parsePrice(rawPrice) : null;
    const cost = rawCost ? parsePrice(rawCost) : null;
    const problems: string[] = [];
    // An unquoted "$1,000" splits into "$1" and "000". Reading that as $1 would
    // silently under-price the item 1,000-fold, so refuse it and say how to fix it.
    const splitThousands = (col: number, raw: string) => {
      if (col < 0 || !/^\$?\d{1,3}$/.test(raw)) return false;
      const next = col + 1;
      if (next === idx.price || next === idx.cost || next === idx.code || next === idx.door) return false;
      return /^\d{3}(\.\d+)?$/.test(cells[next] ?? "");
    };
    if (splitThousands(idx.price, rawPrice)) problems.push(`price "${rawPrice}" looks cut off at a comma - remove the thousands comma or put the price in quotes`);
    if (splitThousands(idx.cost, rawCost)) problems.push(`cost "${rawCost}" looks cut off at a comma - remove the thousands comma or put the cost in quotes`);
    if (!code) problems.push("code is empty");
    if (!door) problems.push("door name is empty");
    if (rawPrice && price == null) problems.push(`price "${rawPrice}" is not a valid amount`);
    if (rawCost && cost == null) problems.push(`cost "${rawCost}" is not a valid amount`);
    if (price == null && cost == null && !problems.length) problems.push("price is empty");
    if (problems.length) { invalid.push({ rowNumber, message: problems.join("; ") + ".", raw: cells }); continue; }
    rows.push({ rowNumber, code, door, ...(price != null ? { price } : {}), ...(cost != null ? { cost } : {}) });
  }
  if (rows.length + invalid.length > MAX_UPLOAD_ROWS) {
    notes.push(`Only the first ${MAX_UPLOAD_ROWS} rows can be uploaded at once; split the file for the rest.`);
    return { rows: rows.slice(0, MAX_UPLOAD_ROWS), invalid, headerDetected, notes };
  }
  return { rows, invalid, headerDetected, notes };
}

// ─── Category for a brand-new master ────────────────────────────────────────
// Only the first letters of the code are read, using families that agree with
// every existing master (W* = Wall 181/181, V* = Vanity, T*/U* = Tall, B*/SB* =
// Base). Anything else becomes "Accessory" - a safe, never-placed category - and
// the administrator corrects it when completing the specification.
export function inferCategoryFromCode(code: string): string {
  const letters = (code.toUpperCase().match(/^[A-Z]+/) ?? [""])[0];
  if (!letters) return "Accessory";
  if (/^(DCW|WDC|W)/.test(letters)) return "Wall";
  if (letters.startsWith("ADA")) return "ADA";
  if (letters[0] === "V" && letters !== "VA") return "Vanity";
  if (/^(T|U)/.test(letters) && !/^(TOE|TRIM|TK|UNIV)/.test(letters)) return "Tall";
  if (/^(SB|BBC|BFH|BT|RB|FHB|B)/.test(letters)) return "Base";
  if (letters === "F" || letters.startsWith("FIL")) return "Filler";
  return "Accessory";
}

/** Master code spelling for a brand-new master, or null if the code is unusable. */
export function newMasterCodeFrom(code: string): string | null {
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned || cleaned.length > 64) return null;
  if (!/^[A-Z0-9][A-Z0-9\-_./]*$/.test(cleaned)) return null;
  if (cleaned.startsWith("ARCHIVE")) return null;
  return cleaned;
}

// ─── Planning ───────────────────────────────────────────────────────────────

export interface PlanStyle {
  id: number;
  styleCode: string;
  ourName: string;
  aliasName?: string | null;
  distributorName?: string | null;
}

export interface PlanMaster {
  id: number;
  masterCode: string;
  sku?: string | null;
  vendorSku?: string | null;
  altSku1?: string | null;
  altSku2?: string | null;
  altSku3?: string | null;
  conflictStatus?: string | null;
}

/** An alias pointing at a master by code or by id (any alias store). */
export interface PlanAliasLink {
  alias: string;
  masterCode?: string | null;
  cabinetId?: number | null;
}

export interface PlanSku {
  id: number;
  cabinetId: number | null;
  styleId: number;
  distributorSku: string;
  listPrice?: string | null;
  yourCost?: string | null;
}

export type PlanAction = "add" | "update" | "unchanged" | "error";

export interface PlannedRow {
  rowNumber: number;
  code: string;
  door: string;
  action: PlanAction;
  message: string;
  /** How the code was recognised. */
  matchedVia: "master" | "alias" | "new" | null;
  masterCode: string | null;
  /** True when this row is the first to bring a brand-new master into being. */
  createsMaster: boolean;
  styleId: number | null;
  styleName: string | null;
  oldPrice: number | null;
  newPrice: number | null;
  oldCost: number | null;
  newCost: number | null;
  // Execution data (not shown to the vendor).
  cabinetKey: string | null; // "id:123" | "new:CANON"
  newMasterCode: string | null;
  newMasterCategory: string | null;
  existingSkuId: number | null;
  /** The matched SKU has no cabinet yet; commit links it to this row's master. */
  linksOrphan: boolean;
  /** Price moves by LARGE_CHANGE_RATIO or more; shown as a warning, never blocked. */
  largeChange: boolean;
  skuKey: string | null;
}

/** A price move at or above this share of the old price is flagged (never blocked). */
export const LARGE_CHANGE_RATIO = 0.5;

export interface PlanSummary {
  total: number;
  largeChanges: number;
  added: number;
  updated: number;
  unchanged: number;
  errors: number;
  newMasters: number;
  viaAlias: number;
}

/** Fractional change between two prices, or null when either is missing/zero. */
export function priceChangeRatio(oldPrice: number | null, newPrice: number | null): number | null {
  if (oldPrice == null || newPrice == null || oldPrice <= 0) return null;
  return Math.abs(newPrice - oldPrice) / oldPrice;
}

const canonDoor = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
const looseDoor = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const money = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function summarizePlan(rows: PlannedRow[]): PlanSummary {
  return {
    total: rows.length,
    largeChanges: rows.filter((r) => r.action === "update" && r.largeChange).length,
    added: rows.filter((r) => r.action === "add").length,
    updated: rows.filter((r) => r.action === "update").length,
    unchanged: rows.filter((r) => r.action === "unchanged").length,
    errors: rows.filter((r) => r.action === "error").length,
    newMasters: rows.filter((r) => r.createsMaster && r.action !== "error").length,
    viaAlias: rows.filter((r) => r.matchedVia === "alias" && r.action !== "error").length,
  };
}

type CodeSource = "master" | "alias";

/** canonical code → cabinetId → how it was recognised. */
export function buildCodeIndex(masters: PlanMaster[], links: PlanAliasLink[], lineSkus: PlanSku[] = []): Map<string, Map<number, CodeSource>> {
  const index = new Map<string, Map<number, CodeSource>>();
  const add = (code: string | null | undefined, cabinetId: number, source: CodeSource) => {
    const canon = normalizeCode(code ?? "");
    if (!canon) return;
    const bucket = index.get(canon) ?? new Map<number, CodeSource>();
    // A direct master match outranks an alias match for the same cabinet.
    if (bucket.get(cabinetId) !== "master") bucket.set(cabinetId, source);
    index.set(canon, bucket);
  };
  const byMasterCanon = new Map<string, number>();
  for (const m of masters) {
    if (m.masterCode.toUpperCase().startsWith("ARCHIVE-")) continue;
    byMasterCanon.set(normalizeCode(m.masterCode), m.id);
    add(m.masterCode, m.id, "master");
    for (const alt of [m.sku, m.vendorSku, m.altSku1, m.altSku2, m.altSku3]) add(alt, m.id, "alias");
  }
  for (const link of links) {
    const target = link.cabinetId ?? (link.masterCode ? byMasterCanon.get(normalizeCode(link.masterCode)) : undefined);
    if (target != null) add(link.alias, target, "alias");
  }
  // The vendor's own codes already on this line are aliases of the cabinet they
  // are attached to (e.g. Skyline "SW-BT09" -> BT09). Without this, a vendor who
  // re-uploads its own price list would get a brand-new master for every row.
  for (const sku of lineSkus) {
    if (sku.cabinetId != null) add(sku.distributorSku, sku.cabinetId, "alias");
  }
  return index;
}

export interface PlanInput {
  rows: UploadRow[];
  styles: PlanStyle[];
  masters: PlanMaster[];
  links: PlanAliasLink[];
  skus: PlanSku[];
}

export function planCodeUpload(input: PlanInput): PlannedRow[] {
  const { rows, styles, masters, links, skus } = input;
  const index = buildCodeIndex(masters, links, skus);
  const masterById = new Map(masters.map((m) => [m.id, m]));
  const styleById = new Map(styles.map((s) => [s.id, s]));

  const skuByCabinetStyle = new Map<string, PlanSku>();
  const skuByStyleCode = new Map<string, PlanSku>();
  for (const sku of skus) {
    if (sku.cabinetId != null) {
      const key = `${sku.cabinetId}:${sku.styleId}`;
      if (!skuByCabinetStyle.has(key)) skuByCabinetStyle.set(key, sku);
    }
    const codeKey = `${sku.styleId}:${normalizeCode(sku.distributorSku)}`;
    if (!skuByStyleCode.has(codeKey)) skuByStyleCode.set(codeKey, sku);
  }

  // Prices as the plan leaves them, so a repeated row compares to the one before it.
  const planned = new Map<string, { price: number | null; cost: number | null }>();
  const newMasters = new Map<string, { masterCode: string; category: string }>();
  const doorHelp = styles.slice(0, 6).map((s) => s.aliasName || s.ourName).join(", ");

  const out: PlannedRow[] = [];
  for (const row of rows) {
    const base: PlannedRow = {
      rowNumber: row.rowNumber, code: row.code, door: row.door, action: "error", message: "",
      matchedVia: null, masterCode: null, createsMaster: false, styleId: null, styleName: null,
      oldPrice: null, newPrice: row.price ?? null, oldCost: null, newCost: row.cost ?? null,
      cabinetKey: null, newMasterCode: null, newMasterCategory: null, existingSkuId: null, linksOrphan: false, largeChange: false, skuKey: null,
    };
    const fail = (message: string, extra: Partial<PlannedRow> = {}) => out.push({ ...base, ...extra, action: "error", message });

    if (row.price == null && row.cost == null) { fail("Needs a price."); continue; }

    // Door → exactly one style on this line.
    const wanted = canonDoor(row.door);
    const names = (s: PlanStyle) => [s.ourName, s.aliasName, s.distributorName, s.styleCode].filter((v): v is string => Boolean(v));
    let matched = styles.filter((s) => names(s).some((n) => canonDoor(n) === wanted));
    if (matched.length === 0) {
      const loose = looseDoor(row.door);
      if (loose) matched = styles.filter((s) => names(s).some((n) => looseDoor(n) === loose));
    }
    if (matched.length !== 1) {
      fail(matched.length === 0
        ? `Door "${row.door}" is not a door on this line${doorHelp ? ` (for example: ${doorHelp})` : ""}.`
        : `Door "${row.door}" matches more than one door style - use the full door name.`);
      continue;
    }
    const style = matched[0];
    const styleName = style.aliasName || style.ourName;
    const withStyle = { styleId: style.id, styleName };

    // Code → master / alias / new master.
    const canon = normalizeCode(row.code);
    if (!canon) { fail("Code is empty.", withStyle); continue; }
    // An exact master code is authoritative: it outranks aliases that other
    // cabinets happen to carry for the same spelling.
    const allHits = index.get(canon);
    const masterHits = allHits ? new Map(Array.from(allHits.entries()).filter(([, s]) => s === "master")) : undefined;
    const hits = masterHits && masterHits.size > 0 ? masterHits : allHits;
    let cabinetKey: string;
    let matchedVia: PlannedRow["matchedVia"];
    let masterCode: string;
    let createsMaster = false;
    let newMasterCode: string | null = null;
    let newMasterCategory: string | null = null;
    let cabinetId: number | null = null;

    if (hits && hits.size > 1) {
      fail("This code matches more than one master cabinet and needs administrator review.", withStyle);
      continue;
    }
    if (hits && hits.size === 1) {
      const [[id, source]] = Array.from(hits.entries());
      const master = masterById.get(id)!;
      if (master.conflictStatus === "conflict") {
        fail(`Master ${master.masterCode} is held for administrator review and cannot take uploads yet.`, { ...withStyle, masterCode: master.masterCode });
        continue;
      }
      cabinetId = id; cabinetKey = `id:${id}`; matchedVia = source; masterCode = master.masterCode;
    } else {
      const spelled = newMasterCodeFrom(row.code);
      if (!spelled) { fail(`"${row.code}" cannot be used as a new cabinet code (letters, numbers, - _ . / only, 64 characters at most).`, withStyle); continue; }
      cabinetKey = `new:${canon}`; matchedVia = "new"; masterCode = spelled;
      let reg = newMasters.get(canon);
      if (!reg) {
        reg = { masterCode: spelled, category: inferCategoryFromCode(spelled) };
        newMasters.set(canon, reg);
        createsMaster = true;
      }
      masterCode = reg.masterCode; newMasterCode = reg.masterCode; newMasterCategory = reg.category;
    }

    // Existing SKU for this cabinet + door (an alias must not create a twin).
    const skuKey = `${cabinetKey}:${style.id}`;
    // Same code + door already on this line (even with no cabinet yet) is the same item.
    const existing = (cabinetId != null ? skuByCabinetStyle.get(`${cabinetId}:${style.id}`) : undefined)
      ?? skuByStyleCode.get(`${style.id}:${canon}`);
    const linksOrphan = Boolean(existing && existing.cabinetId == null);
    const seen = planned.get(skuKey);

    const oldPrice = seen ? seen.price : existing ? money(existing.listPrice) : null;
    const oldCost = seen ? seen.cost : existing ? money(existing.yourCost) : null;
    const newPrice = row.price ?? null;
    const newCost = row.cost ?? null;
    const common: Partial<PlannedRow> = {
      ...withStyle, matchedVia, masterCode, createsMaster, cabinetKey, newMasterCode, newMasterCategory,
      existingSkuId: existing?.id ?? null, linksOrphan, skuKey, oldPrice, oldCost,
    };
    planned.set(skuKey, { price: newPrice ?? oldPrice, cost: newCost ?? oldCost });

    if (existing || seen) {
      const same = !linksOrphan && (newPrice == null || newPrice === oldPrice) && (newCost == null || newCost === oldCost);
      const ratio = !same ? priceChangeRatio(oldPrice, newPrice) : null;
      const largeChange = ratio != null && ratio >= LARGE_CHANGE_RATIO;
      const warn = largeChange ? ` Large change (${Math.round(ratio! * 100)}%) - please double-check.` : "";
      out.push({
        ...base, ...common, largeChange,
        action: same ? "unchanged" : "update",
        message: (seen ? "Repeated in this file - the later price is used."
          : linksOrphan ? `Existing item with no cabinet yet - linked to ${masterCode} and price updated.`
          : same ? "Price already matches." : "Price will be updated.") + warn,
      });
      continue;
    }
    out.push({
      ...base, ...common,
      action: "add",
      message: matchedVia === "new"
        ? (createsMaster ? "New cabinet - created as a master and held for review." : "New door for a cabinet created in this upload.")
        : matchedVia === "alias" ? `Recognised as an alias of ${masterCode}. Added for review.` : "Added for review.",
    });
  }
  return out;
}

/** Platform SKU for a freshly added line SKU. Unique per master + door + line. */
export function buildPlatformSku(masterCode: string, styleCode: string, lineCode: string, taken: Set<string>, styleId: number, canonCode: string): string {
  const clip = (s: string) => s.slice(0, 128);
  const candidates = [
    clip(`${masterCode}-${styleCode}-${lineCode}`),
    clip(`${masterCode}-${styleCode}-${lineCode}-${styleId}`),
    clip(`${masterCode}-${styleCode}-${lineCode}-${styleId}-${canonCode}`),
  ];
  for (const c of candidates) if (!taken.has(c)) return c;
  let n = 2;
  while (taken.has(clip(`${candidates[1]}-${n}`))) n += 1;
  return clip(`${candidates[1]}-${n}`);
}
