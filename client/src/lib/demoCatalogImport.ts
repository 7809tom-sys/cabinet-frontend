// ─── Demo distributor: spreadsheet catalog import (client-side only) ─────────
// A distributor uploads a CSV price list; it is parsed and validated in the
// browser and shown populating lines → door styles → items. No backend, no
// database. The real counterpart is the distributor catalog importer
// (CatalogImporterTab / distributorPortal.importCatalogSpreadsheet).

export const SAMPLE_CSV_PATH = "/demo/distributor-catalog-sample.csv";

export const SAMPLE_CSV_COLUMNS = [
  "line", "door_style", "door_style_code", "color", "code", "description",
  "width", "height", "depth", "group", "category", "price",
] as const;

const REQUIRED = ["line", "door_style", "code"] as const;
export const IMPORT_GROUPS = ["Bases", "Walls", "Talls", "Specialties"] as const;

/** Real catalog codes used in the sample file (each must exist in the demo catalog). */
export const SAMPLE_CSV_CODES = [
  "B12", "B15", "B18", "B21", "B24", "B27", "B30", "B33", "B36",
  "3DB15", "3DB18", "3DB24", "3DB30", "2DB30",
  "SB30", "SB33", "SB36", "FSB36", "BBC42", "LSB33", "LSB36",
  "W0930", "W1230", "W1830", "W2130", "W2430", "W2730", "W3030", "W3330", "W3630",
  "W1242", "W1542", "W1842", "W2442", "W3042", "W3642",
  "W3012", "W3015", "W3018", "W301224", "W362424", "WBC2430", "DCW2430", "DCW2442",
  "U188424", "U189024", "U248424", "O308424", "O338424", "MO3036", "MW3030",
  "F342", "F396", "F642", "BF6", "TDEP2496", "DP2430", "CM8", "TK8(TKC)",
  "UNIV-ROT24", "UNIV-ROT30", "V3021DL", "VS30",
] as const;

export function toCsvLine(values: Array<string | number>): string {
  return values.map((v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",");
}

/** Small RFC-4180-style parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ImportRow = {
  line: string;
  doorStyle: string;
  doorStyleCode: string;
  color: string;
  code: string;
  description: string;
  widthIn: number | null;
  heightIn: number | null;
  depthIn: number | null;
  group: string;
  category: string;
  price: number | null;
};

export type ImportError = { rowNumber: number; reason: string; raw: string };

export type ImportResult = {
  rows: ImportRow[];
  errors: ImportError[];
  missingColumns: string[];
};

function num(value: string | undefined): number | null | "bad" {
  const v = (value ?? "").trim().replace(/^\$/, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : "bad";
}

/** Parse + validate. Bad rows are reported, never thrown. */
export function importCatalogCsv(text: string): ImportResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [{ rowNumber: 1, reason: "The file is empty.", raw: "" }], missingColumns: [...REQUIRED] };
  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const missingColumns = REQUIRED.filter((c) => !header.includes(c));
  if (missingColumns.length) return { rows: [], errors: [], missingColumns };
  const col = (name: string) => header.indexOf(name);
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const raw = cells.join(",");
    const problems: string[] = [];
    const line = get("line");
    const doorStyle = get("door_style");
    const code = get("code").toUpperCase();
    if (!line) problems.push("missing line");
    if (!doorStyle) problems.push("missing door style");
    if (!code) problems.push("missing code");
    const width = num(get("width"));
    const height = num(get("height"));
    const depth = num(get("depth"));
    const price = num(get("price"));
    if (width === "bad" || height === "bad" || depth === "bad") problems.push("size is not a number");
    if (price === "bad") problems.push("price is not a number");
    const group = get("group");
    if (group && !(IMPORT_GROUPS as readonly string[]).includes(group)) problems.push(`unknown group "${group}"`);
    const key = `${line}|${doorStyle}|${code}`;
    if (!problems.length && seen.has(key)) problems.push("duplicate code in this door style");
    if (problems.length) {
      errors.push({ rowNumber, reason: problems.join("; "), raw });
      return;
    }
    seen.add(key);
    rows.push({
      line, doorStyle, doorStyleCode: get("door_style_code"), color: get("color"), code,
      description: get("description"),
      widthIn: width as number | null, heightIn: height as number | null, depthIn: depth as number | null,
      group: group || "Specialties", category: get("category"), price: price as number | null,
    });
  });
  return { rows, errors, missingColumns: [] };
}

export type ImportSummary = {
  lines: { name: string; doorStyles: { name: string; code: string; items: number }[]; items: number }[];
  lineCount: number;
  doorStyleCount: number;
  itemCount: number;
};

export function summarizeImport(rows: ImportRow[]): ImportSummary {
  const lines = new Map<string, Map<string, { code: string; items: number }>>();
  for (const r of rows) {
    const styles = lines.get(r.line) ?? new Map();
    const s = styles.get(r.doorStyle) ?? { code: r.doorStyleCode, items: 0 };
    s.items++;
    styles.set(r.doorStyle, s);
    lines.set(r.line, styles);
  }
  const out = Array.from(lines.entries()).map(([name, styles]) => {
    const doorStyles = Array.from(styles.entries()).map(([sName, v]) => ({ name: sName, code: v.code, items: v.items }));
    return { name, doorStyles, items: doorStyles.reduce((n, s) => n + s.items, 0) };
  });
  return {
    lines: out,
    lineCount: out.length,
    doorStyleCount: out.reduce((n, l) => n + l.doorStyles.length, 0),
    itemCount: rows.length,
  };
}

export function formatElapsed(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

export const IMPORT_COPY = {
  title: "Spreadsheet catalog import",
  body: "Send your price list as a spreadsheet. It's read straight into your catalog in one pass: your lines, their door styles and every item with its size and price. You don't type products in one at a time. The only step left is a photo for each door style.",
  download: "Download sample spreadsheet",
  loadSample: "Load sample",
  upload: "Upload a spreadsheet (.csv)",
  drop: "Drop a .csv file here, or choose one",
  csvOnly: "CSV files only in this demo. Save an Excel sheet as .csv first.",
  stages: { lines: "Creating lines", styles: "Creating door styles", items: "Loading items", done: "Catalog loaded" },
  loadedIn: (elapsed: string) => `Catalog loaded in ${elapsed}`,
  badRows: (n: number) => `${n} row${n === 1 ? "" : "s"} skipped. Fix and re-upload:`,
  checklistTitle: "Go-live checklist",
  remaining: "Add a picture to each door style",
  demoNote: "Demo only: the file is read in your browser and nothing is uploaded.",
} as const;
