// Client half of cabinet-backend vendorOnboarding.
// Spreadsheet columns match shared/vendorOnboarding.ts on that branch so an
// .xlsx parsed here and a CSV parsed on the server describe the same rows.

import { normalizeCode } from "@shared/cabinetCodeMatch";

export const MAX_ONBOARDING_ROWS = 5000;
export const MAX_ONBOARDING_TEXT = 2_000_000;

export const SPECIAL_FIELDS = ["distributorName", "style", "color", "price"] as const;
export type SpecialField = (typeof SPECIAL_FIELDS)[number];
export type OnboardingFlagReason = "unknown_sku" | "ambiguous" | "missing_special";
export type OnboardingRowStatus = "matched" | "flagged" | "completed";

export type OnboardingSummaryCounts = {
  total: number;
  matched: number;
  flagged: number;
  completed: number;
  trimHeld: number;
  styleUnmapped: number;
};

export const EMPTY_ONBOARDING_SUMMARY: OnboardingSummaryCounts = {
  total: 0,
  matched: 0,
  flagged: 0,
  completed: 0,
  trimHeld: 0,
  styleUnmapped: 0,
};

/** Plain-language meaning of each count. Shared by the vendor screen and tests. */
export const SUMMARY_EXPLANATIONS: Record<keyof OnboardingSummaryCounts, { label: string; explanation: string }> = {
  total: {
    label: "Total",
    explanation: "Rows in this spreadsheet.",
  },
  matched: {
    label: "Matched",
    explanation: "Matched SKUs only needed distributor, style, color and price.",
  },
  flagged: {
    label: "Flagged",
    explanation: "These rows still need details before they can be finished.",
  },
  completed: {
    label: "Completed",
    explanation: "These rows were finished. An unknown or ambiguous SKU is a public cabinet conflict review, not a verified master.",
  },
  trimHeld: {
    label: "Trim held",
    explanation: "Trim stays with the supplier that already sells it.",
  },
  styleUnmapped: {
    label: "Style unmapped",
    explanation: "The style text didn't match a door on their line, so no price was published.",
  },
};

export const CONFLICT_REVIEW_MESSAGE = "went to CabinetDealz cabinet conflict review and stays public";

export type OnboardingDoor = { id: number; name: string; color: string | null };

export type InheritedCabinet = {
  cabinetId: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
};

export type OnboardingRow = {
  id: number;
  importId: number;
  distributorId: number;
  rowNumber: number;
  sku: string;
  status: OnboardingRowStatus;
  flagReason: OnboardingFlagReason | null;
  missingFields: SpecialField[];
  needsFullDetails: boolean;
  cabinetId: number | null;
  masterCode: string | null;
  matchedVia: string | null;
  candidateMasterCodes: string[];
  reviewCabinetId: number | null;
  distributorName: string | null;
  style: string | null;
  color: string | null;
  price: string | null;
  styleId: number | null;
  skuId: number | null;
  category: string | null;
  subCategory: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  description: string | null;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
  trimHeld: boolean;
  trimSupplierId: number | null;
  message: string | null;
  inherited: InheritedCabinet | null;
};

export type AdminOnboardingRow = OnboardingRow & {
  conflictStatus: string | null;
  conflictReason: string | null;
  staysPublic: boolean;
};

export type OnboardingSheetRow = {
  rowNumber: number;
  sku: string;
  distributorName?: string | null;
  style?: string | null;
  color?: string | null;
  price?: string | null;
  category?: string | null;
  subCategory?: string | null;
  width?: string | null;
  height?: string | null;
  depth?: string | null;
  description?: string | null;
  numberOfDoors?: string | null;
  numberOfDrawers?: string | null;
};

export type DetailDraft = {
  distributorName: string;
  style: string;
  color: string;
  price: string;
  category: string;
  subCategory: string;
  width: string;
  height: string;
  depth: string;
  description: string;
  numberOfDoors: string;
  numberOfDrawers: string;
};

export type SubmitDetailsInput = {
  distributorId?: number;
  rowId: number;
  distributorName?: string;
  style?: string;
  color?: string;
  price?: number;
  category?: string;
  subCategory?: string | null;
  width?: number;
  height?: number;
  depth?: number;
  description?: string;
  numberOfDoors?: number;
  numberOfDrawers?: number;
};

const NINE_INCH_BASE_CODES = new Set([
  "B9", "B09", "BT9", "BT09", "BFH9", "BFH09", "TB9", "TB09", "FHB9", "FHB09", "FH9", "FHBO9", "TBO9",
]);

const HEADER_WORDS: Record<string, readonly string[]> = {
  sku: ["sku", "code", "nomenclature", "item", "itemcode", "itemnumber", "itemno", "partnumber", "partno", "part", "cabinet", "cabinetcode", "model", "mastercode", "alias", "vendorsku", "distributorsku", "productcode", "product"],
  price: ["price", "listprice", "list", "msrp", "unitprice", "sellprice", "sell", "retail"],
  style: ["style", "door", "doorname", "doorstyle", "stylename"],
  color: ["color", "colour", "finish", "doorcolor", "doorfinish", "stain", "staincolor"],
  distributorName: ["distributor", "distributorname", "vendor", "vendorname", "supplier", "suppliername", "linename"],
  category: ["category", "type", "cabinettype", "producttype"],
  subCategory: ["subcategory", "subtype"],
  width: ["width", "widthin"],
  height: ["height", "heightin"],
  depth: ["depth", "depthin"],
  description: ["description", "desc", "cabinetname"],
  numberOfDoors: ["doors", "numberofdoors", "doorcount"],
  numberOfDrawers: ["drawers", "numberofdrawers", "drawercount"],
};

const HEADER_FIELDS = Object.keys(HEADER_WORDS);

const FULL_DETAIL_FIELDS = [
  "distributorName",
  "style",
  "color",
  "price",
  "category",
  "subCategory",
  "width",
  "height",
  "depth",
  "description",
  "numberOfDoors",
  "numberOfDrawers",
] as const;

export type FullDetailField = (typeof FULL_DETAIL_FIELDS)[number];

function headerKey(cell: string): string {
  return (cell ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numeric(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/["\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** 9" bases, including tray and full-height codes such as BT9, never have drawers. */
export function isNineInchBase(input: {
  width?: number | string | null;
  category?: string | null;
  subCategory?: string | null;
  masterCode?: string | null;
  description?: string | null;
}): boolean {
  const code = normalizeCode(input.masterCode ?? "");
  if (NINE_INCH_BASE_CODES.has(code)) return true;
  const width = numeric(input.width);
  if (width == null || Math.abs(width - 9) > 0.05) return false;
  const family = `${input.category ?? ""}`.toLowerCase();
  const detail = `${input.subCategory ?? ""} ${input.description ?? ""}`.toLowerCase();
  if (family.includes("wall") || family.includes("tall") || family.includes("vanity")) return false;
  return family.includes("base") || /tray|full[\s-]?height/.test(detail);
}

/** Industry rule: a 9-inch base forces the drawer count to 0. */
export function forcedDrawerCount(input: {
  width?: number | string | null;
  category?: string | null;
  subCategory?: string | null;
  masterCode?: string | null;
  description?: string | null;
  numberOfDrawers?: number | string | null;
}): string {
  if (isNineInchBase(input)) return "0";
  if (input.numberOfDrawers == null) return "";
  return String(input.numberOfDrawers);
}

export function drawerFieldState(input: {
  width?: number | string | null;
  category?: string | null;
  subCategory?: string | null;
  masterCode?: string | null;
  description?: string | null;
  numberOfDrawers?: number | string | null;
}): { value: string; locked: boolean } {
  const locked = isNineInchBase(input);
  return { value: forcedDrawerCount(input), locked };
}

export function flagReasonLabel(reason: OnboardingFlagReason | null): string {
  if (reason === "unknown_sku") return "Unknown SKU";
  if (reason === "ambiguous") return "Matches more than one cabinet";
  if (reason === "missing_special") return "Missing distributor, style, color, or price";
  return "Needs details";
}

export function conflictReviewSentence(sku: string): string {
  return `${sku} ${CONFLICT_REVIEW_MESSAGE}.`;
}

export function conflictEditorHref(reviewCabinetId: number): string {
  return `/admin?tab=conflicts&cabinetId=${reviewCabinetId}`;
}

/** Completed rows open the conflict editor. A matched master id is not that link. */
export function completedConflictHref(row: {
  status: string;
  reviewCabinetId: number | null;
}): string | null {
  if (row.status !== "completed" || row.reviewCabinetId == null) return null;
  return conflictEditorHref(row.reviewCabinetId);
}

export function conflictCabinetIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get("cabinetId");
  if (raw == null || raw.trim() === "") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function flaggedRowsOnly<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.status === "flagged");
}

export function badRequestMessage(error: {
  message?: string;
  data?: { code?: string } | null;
  shape?: { data?: { code?: string } | null } | null;
}): string | null {
  const code = error.data?.code ?? error.shape?.data?.code;
  if (code !== "BAD_REQUEST") return null;
  const message = error.message?.trim();
  return message || "That detail was rejected.";
}

export function styleChoices(doors: OnboardingDoor[], current: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  if (current.trim() && !doors.some((door) => door.name === current)) {
    names.push(current);
    seen.add(current);
  }
  for (const door of doors) {
    if (!door.name || seen.has(door.name)) continue;
    seen.add(door.name);
    names.push(door.name);
  }
  return names;
}

export function draftFromRow(row: OnboardingRow): DetailDraft {
  return {
    distributorName: row.distributorName ?? "",
    style: row.style ?? "",
    color: row.color ?? "",
    price: row.price ?? "",
    category: row.category ?? row.inherited?.category ?? "",
    subCategory: row.subCategory ?? row.inherited?.subCategory ?? "",
    width: row.width ?? row.inherited?.width ?? "",
    height: row.height ?? row.inherited?.height ?? "",
    depth: row.depth ?? row.inherited?.depth ?? "",
    description: row.description ?? row.inherited?.description ?? "",
    numberOfDoors: row.numberOfDoors == null ? (row.inherited?.numberOfDoors == null ? "" : String(row.inherited.numberOfDoors)) : String(row.numberOfDoors),
    numberOfDrawers: row.numberOfDrawers == null ? (row.inherited?.numberOfDrawers == null ? "" : String(row.inherited.numberOfDrawers)) : String(row.numberOfDrawers),
  };
}

export function fieldsForRow(row: Pick<OnboardingRow, "needsFullDetails" | "missingFields">): readonly string[] {
  if (row.needsFullDetails) return FULL_DETAIL_FIELDS;
  return row.missingFields;
}

function finiteNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerNumber(raw: string): number | null {
  const parsed = finiteNumber(raw);
  if (parsed == null || !Number.isInteger(parsed)) return null;
  return parsed;
}

export function submitDetailsInput(
  row: OnboardingRow,
  draft: DetailDraft,
  distributorId?: number,
): { input: SubmitDetailsInput } | { error: string } {
  const input: SubmitDetailsInput = { rowId: row.id };
  if (distributorId) input.distributorId = distributorId;
  const nine = isNineInchBase({
    width: draft.width || row.width || row.inherited?.width,
    category: draft.category || row.category || row.inherited?.category,
    subCategory: draft.subCategory || row.subCategory || row.inherited?.subCategory,
    description: draft.description || row.description || row.inherited?.description,
    masterCode: row.masterCode ?? row.sku,
  });
  const requested = fieldsForRow(row);

  for (const field of requested) {
    if (field === "price") {
      const raw = draft.price.trim();
      if (!raw) continue;
      const price = finiteNumber(raw);
      if (price == null) return { error: "Price is not a valid amount." };
      input.price = price;
      continue;
    }
    if (field === "width" || field === "height" || field === "depth") {
      const raw = draft[field].trim();
      if (!raw) continue;
      const value = finiteNumber(raw);
      if (value == null) return { error: `${field[0].toUpperCase()}${field.slice(1)} is not a valid number.` };
      input[field] = value;
      continue;
    }
    if (field === "numberOfDoors") {
      const raw = draft.numberOfDoors.trim();
      if (!raw) continue;
      const value = integerNumber(raw);
      if (value == null) return { error: "Doors must be a whole number." };
      input.numberOfDoors = value;
      continue;
    }
    if (field === "numberOfDrawers") {
      const raw = nine ? "0" : draft.numberOfDrawers.trim();
      if (!raw) continue;
      const value = integerNumber(raw);
      if (value == null) return { error: "Drawers must be a whole number." };
      input.numberOfDrawers = value;
      continue;
    }
    if (field === "subCategory") {
      input.subCategory = draft.subCategory.trim() || null;
      continue;
    }
    if (field === "distributorName" || field === "style" || field === "color" || field === "category" || field === "description") {
      const text = draft[field].trim();
      if (text) input[field] = text;
    }
  }

  if (row.needsFullDetails && nine) input.numberOfDrawers = 0;
  return { input };
}

export function parseOnboardingSheetGrid(grid: string[][]): { rows: OnboardingSheetRow[]; notes: string[] } {
  const notes: string[] = [];
  const clean = grid.map((cells) => cells.map((cell) => String(cell ?? "").trim()));
  const first = clean.findIndex((cells) => cells.some((cell) => cell !== ""));
  if (first === -1) return { rows: [], notes };
  const header = clean[first];
  const idx: Record<string, number> = {};
  header.forEach((cell, column) => {
    const key = headerKey(cell);
    if (!key) return;
    for (const field of HEADER_FIELDS) {
      if (idx[field] == null && HEADER_WORDS[field].includes(key)) {
        idx[field] = column;
        return;
      }
    }
  });
  const headerDetected = idx.sku != null && (idx.price != null || idx.style != null || idx.color != null);
  const dataStart = headerDetected ? first + 1 : first;
  if (!headerDetected) {
    idx.sku = 0;
    idx.distributorName = 1;
    idx.style = 2;
    idx.color = 3;
    idx.price = 4;
    notes.push("No header row found. Columns were read as SKU, distributor, style, color, price.");
  }
  const rows: OnboardingSheetRow[] = [];
  for (let index = dataStart; index < clean.length; index += 1) {
    const cells = clean[index];
    if (!cells.some((cell) => cell !== "")) continue;
    const read = (field: string): string | null => {
      const column = idx[field];
      if (column == null) return null;
      const value = (cells[column] ?? "").trim();
      return value || null;
    };
    rows.push({
      rowNumber: index + 1,
      sku: read("sku") ?? "",
      distributorName: read("distributorName"),
      style: read("style"),
      color: read("color"),
      price: read("price"),
      category: read("category"),
      subCategory: read("subCategory"),
      width: read("width"),
      height: read("height"),
      depth: read("depth"),
      description: read("description"),
      numberOfDoors: read("numberOfDoors"),
      numberOfDrawers: read("numberOfDrawers"),
    });
    if (rows.length >= MAX_ONBOARDING_ROWS) {
      notes.push(`Only the first ${MAX_ONBOARDING_ROWS} rows can be imported at once.`);
      break;
    }
  }
  return { rows, notes };
}

export type PreparedUpload =
  | { ok: true; fileName: string; text?: string; rows?: OnboardingSheetRow[]; notes: string[] }
  | { ok: false; message: string };

export async function prepareOnboardingUpload(file: File): Promise<PreparedUpload> {
  const spreadsheet = /\.(xlsx|xls)$/i.test(file.name);
  if (!spreadsheet) {
    const text = await file.text();
    if (text.length > MAX_ONBOARDING_TEXT) {
      return { ok: false, message: "That file is too large to import at once." };
    }
    if (!text.trim()) return { ok: false, message: "The spreadsheet has no data rows." };
    return { ok: true, fileName: file.name, text, notes: [] };
  }
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) return { ok: false, message: "The spreadsheet has no data rows." };
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  const parsed = parseOnboardingSheetGrid(grid.map((cells) => (Array.isArray(cells) ? cells : []).map((cell) => String(cell ?? ""))));
  if (parsed.rows.length === 0) return { ok: false, message: "The spreadsheet has no data rows." };
  return { ok: true, fileName: file.name, rows: parsed.rows, notes: parsed.notes };
}

export function ingestInputFromPrepared(
  prepared: Extract<PreparedUpload, { ok: true }>,
  distributorId?: number,
): {
  distributorId?: number;
  fileName: string;
  text?: string;
  rows?: OnboardingSheetRow[];
} {
  return {
    ...(distributorId ? { distributorId } : {}),
    fileName: prepared.fileName,
    ...(prepared.rows ? { rows: prepared.rows } : { text: prepared.text ?? "" }),
  };
}

export type AdminListSelection = {
  distributorId?: number;
  importId?: number;
  status?: "matched" | "flagged" | "completed";
};

export function adminListInput(selection: AdminListSelection): AdminListSelection & { limit: number } {
  const input: AdminListSelection & { limit: number } = { limit: 200 };
  if (selection.distributorId) input.distributorId = selection.distributorId;
  if (selection.importId) input.importId = selection.importId;
  if (selection.status) input.status = selection.status;
  return input;
}

export const ONBOARDING_TEMPLATE = "SKU,Distributor,Style,Color,Price\nB12,,Shaker,White,189.00\n";
