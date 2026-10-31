import { isAefFramelessStyleCode } from "./aefFramelessSpecs";
import { findDlcFinishForStyle } from "./dlcFr26Mapping";

/**
 * Door face vs drawer front.
 *
 * A frameless (altaeuro / USCD) swatch is a base cabinet: a short drawer front,
 * a thin reveal, then the door. Wall cabinets and full-height door faces use
 * only the door image — one solid face, no drawer band. Drawer meshes use only
 * the drawer-front image.
 *
 * The two stored images are the existing door_styles columns
 * doorSampleImageUrl and drawerSampleImageUrl. This module does not invent a
 * second pair of URL columns.
 */

export const USCD_DRAWER_FRONT_IN = 7.5;
export const USCD_DOOR_BELOW_REVEAL_IN = 22.5;
/** Render-time ratio only. The bulk split never uses this when a reveal is missed. */
export const USCD_REVEAL_FALLBACK_FRACTION =
  USCD_DRAWER_FRONT_IN / (USCD_DRAWER_FRONT_IN + USCD_DOOR_BELOW_REVEAL_IN);

/** Keep the dark reveal out of both crops when the only file is the combined swatch. */
export const USCD_COMBINED_REVEAL_GAP = 0.03;
/** Sample captions and page margins sit in the outer band of a catalog swatch. */
export const USCD_COMBINED_OUTER_MARGIN = 0.1;

export type FaceTextureWindow = {
  offsetX: number;
  offsetY: number;
  repeatX: number;
  repeatY: number;
};

/**
 * UV window for one face of a combined door+drawer swatch.
 * Image top is the drawer (about 7.5 in). Three.js flipY puts that at v = 1.
 * Door faces use the lower band. Drawer faces use the upper band. The bands do not overlap.
 */
export function combinedSwatchTextureWindow(face: "door" | "drawer"): FaceTextureWindow {
  const drawer = USCD_REVEAL_FALLBACK_FRACTION;
  const gap = USCD_COMBINED_REVEAL_GAP;
  const margin = USCD_COMBINED_OUTER_MARGIN;
  if (face === "drawer") {
    const offsetY = 1 - drawer + gap;
    const repeatY = Math.max(0.08, drawer - gap - margin);
    return { offsetX: 0, offsetY, repeatX: 1, repeatY };
  }
  return {
    offsetX: 0,
    offsetY: margin,
    repeatX: 1,
    repeatY: Math.max(0.2, 1 - drawer - gap - margin),
  };
}

export const USCD_SOURCE_MANUAL = "USCD Spec Manual V8.2";

/** New door styles stay unverified until an admin marks them. Missing column = verified. */
export const NEW_DOOR_STYLE_VERIFIED = false;

export const DOOR_DRAWER_SEPARATION_CLAUSE =
  "Never merge a door and a drawer front into one image. Door faces, wall cabinets, and full-height tall doors match the DOOR reference only: one solid face, consistent grain, no drawer band, drawer line, or second section. Drawer fronts match the DRAWER_FRONT reference only. Do not rotate horizontal grain to vertical.";

const USCD_STYLE_CODE =
  /^(TWP|TGW|TDW|PGW|ZS[A-Z]|ZC[A-Z]|SC[A-Z]|LS[A-Z]|SS[A-Z])$/i;

const FRAMELESS_TEXT = /frameless|altaeuro|alta euro|\baef\b|us cabinet depot/i;

export type FaceClass = "DOOR" | "DRAWER_FRONT";

export type FaceSourceKind = "split" | "combined" | "legacy-door" | "none";

export type DoorStyleFaceInput = {
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  distributorName?: string | null;
  supplierBrandName?: string | null;
  supplierName?: string | null;
  boxConstruction?: string | null;
  overlayType?: string | null;
  doorSampleImageUrl?: string | null;
  drawerSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  styleVerified?: boolean | number | null;
  grainDirection?: string | null;
  distributorId?: number | null;
};

export type CabinetFacePlan = {
  sourceKind: FaceSourceKind;
  doorUrl: string | null;
  drawerUrl: string | null;
  /** Wall and tall door faces are one section. A base with a separate drawer image is two. */
  sections: 1 | 2;
  drawerTextureApplied: boolean;
  /** Torino horizontal grain stays at 0. This plan never rotates a face texture. */
  grainRotation: 0;
  /** Set when the textures are processed DLC_FR26 crops (already cropped; fit, never tile). */
  dlcCrop?: {
    slug: string;
    doorSize: [number, number];
    drawerSize: [number, number] | null;
    /** Drawer front colour when the photo has no drawer crop. The drawer never gets the door image. */
    drawerSolidColor: string | null;
  };
};

export type RevealDetection =
  | {
      detected: true;
      height: number;
      darkestRow: number;
      dip: number;
      revealStart: number;
      revealEnd: number;
      drawerLastRow: number;
      doorStartRow: number;
    }
  | { detected: false; reason: "short-image" | "no-dip" | "thick-rail" };

function trimUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function uscdSourceNote(pdfPage: number | null | undefined): string {
  const page = Number(pdfPage);
  if (!Number.isFinite(page) || page <= 0) return USCD_SOURCE_MANUAL;
  return `${USCD_SOURCE_MANUAL}, page ${page}`;
}

export function isUscdStyleCode(styleCode: string | null | undefined): boolean {
  return USCD_STYLE_CODE.test((styleCode ?? "").trim());
}

const NAMED_AEF_STYLE_CODE = /\b(?:TWP|TGW|TDW|PGW|(?:LS|ZS|ZC|SS|SC)[A-Z])\b/;

export function isFramelessDoorStyle(style: DoorStyleFaceInput | null | undefined): boolean {
  if (!style) return false;
  if (isAefFramelessStyleCode(style.styleCode) || isUscdStyleCode(style.styleCode)) return true;
  // A saved row can keep the code in the display name after the style-code
  // column is blank (Luxe Classic LSA on a framed distributor name).
  const named = [style.ourName, style.aliasName].filter((part) => part && part.trim()).join(" ").toUpperCase();
  const namedCode = named.match(NAMED_AEF_STYLE_CODE)?.[0] ?? null;
  if (isAefFramelessStyleCode(namedCode)) return true;
  const text = [style.distributorName, style.supplierBrandName, style.supplierName, style.boxConstruction, style.overlayType]
    .filter((part) => part && part.trim())
    .join(" ");
  return FRAMELESS_TEXT.test(text);
}

/** A missing verification column is treated as verified so the Designer keeps working before the SQL is applied. */
export function isDoorStyleVerified(style: { styleVerified?: boolean | number | null } | null | undefined): boolean {
  if (!style || style.styleVerified === undefined || style.styleVerified === null) return true;
  return style.styleVerified === true || style.styleVerified === 1;
}

/**
 * Find the thin reveal between a drawer front and the door.
 * Returns undetected when the dip is weak or the dark band is a frame rail.
 * Does not fall back to the 7.5 / 22.5 ratio.
 */
export function detectHorizontalReveal(rowLuminance: readonly number[]): RevealDetection {
  const height = rowLuminance.length;
  if (height < 40) return { detected: false, reason: "short-image" };
  const rows = rowLuminance;
  const baseLo = Math.floor(height * 0.04);
  const baseHi = Math.max(baseLo + 1, Math.floor(height * 0.12));
  const searchLo = Math.floor(height * 0.12);
  const searchHi = Math.max(searchLo + 1, Math.floor(height * 0.4));
  const baseline = median(rows.slice(baseLo, baseHi));
  let darkestRow = searchLo;
  for (let y = searchLo + 1; y < searchHi; y += 1) {
    if (rows[y]! < rows[darkestRow]!) darkestRow = y;
  }
  const dip = baseline - rows[darkestRow]!;
  if (dip < 25) return { detected: false, reason: "no-dip" };

  let revealStart = darkestRow;
  while (revealStart > 0 && baseline - rows[revealStart - 1]! > 12) revealStart -= 1;
  let darkEnd = darkestRow;
  while (darkEnd + 1 < height && baseline - rows[darkEnd + 1]! > 12) darkEnd += 1;
  const darkThickness = darkEnd - revealStart + 1;

  let whiteStart = -1;
  const transitionCap = Math.min(height - 1, darkEnd + 8);
  for (let y = darkEnd + 1; y <= transitionCap; y += 1) {
    if (rows[y]! >= 240) {
      whiteStart = y;
      break;
    }
  }
  let revealEnd = darkEnd;
  if (whiteStart >= 0) {
    revealEnd = whiteStart;
    const whiteCap = Math.min(height - 1, darkEnd + Math.floor(height * 0.04));
    while (revealEnd + 1 <= whiteCap && rows[revealEnd + 1]! >= 240) revealEnd += 1;
  }
  const thickRail = darkThickness > Math.max(20, Math.floor(height * 0.035));
  if (thickRail && whiteStart < 0) return { detected: false, reason: "thick-rail" };
  if (darkThickness > Math.max(40, Math.floor(height * 0.08))) return { detected: false, reason: "thick-rail" };

  const sampleLo = Math.min(height - 2, revealEnd + Math.max(8, Math.floor(height * 0.03)));
  const sampleHi = Math.max(sampleLo + 1, Math.floor(height * 0.85));
  const doorMedian = median(rows.slice(sampleLo, sampleHi));
  let doorStartRow = revealEnd + 1;
  const doorCap = Math.min(height - 1, revealEnd + Math.floor(height * 0.06));
  for (let y = revealEnd + 1; y <= doorCap; y += 1) {
    if (Math.abs(rows[y]! - doorMedian) <= 20) {
      doorStartRow = y;
      break;
    }
  }
  const drawerLastRow = Math.max(0, revealStart - 1);
  if (doorStartRow <= drawerLastRow) return { detected: false, reason: "no-dip" };
  return {
    detected: true,
    height,
    darkestRow,
    dip,
    revealStart,
    revealEnd,
    drawerLastRow,
    doorStartRow,
  };
}

export function rowLuminanceFromImageData(data: Uint8ClampedArray, width: number, height: number): number[] {
  const rows: number[] = [];
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    const off = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const i = off + x * 4;
      sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    }
    rows.push(sum / Math.max(1, width));
  }
  return rows;
}

export function classifyFaceSource(style: DoorStyleFaceInput | null | undefined): FaceSourceKind {
  if (!style) return "none";
  const door = trimUrl(style.doorSampleImageUrl) ?? trimUrl(style.thumbnailImageUrl);
  const drawer = trimUrl(style.drawerSampleImageUrl);
  if (door && drawer && door !== drawer) return "split";
  if (door && drawer && door === drawer) return "combined";
  if (isUscdStyleCode(style.styleCode) && (door || drawer)) return "combined";
  if (door) return "legacy-door";
  return "none";
}

export function resolveCabinetFaceImages(
  style: DoorStyleFaceInput | null | undefined,
  placement: string | null | undefined,
): CabinetFacePlan {
  const wall = (placement ?? "").toLowerCase() === "wall";
  // A DL style that maps to a DLC_FR26 finish uses the processed (cropped) door and drawer PNGs.
  const dlc = findDlcFinishForStyle(style);
  if (dlc) {
    return {
      sourceKind: dlc.drawer ? "split" : "legacy-door",
      doorUrl: dlc.door,
      drawerUrl: wall ? null : dlc.drawer,
      sections: wall ? 1 : dlc.drawer ? 2 : 1,
      drawerTextureApplied: !wall && Boolean(dlc.drawer),
      grainRotation: 0,
      dlcCrop: {
        slug: dlc.slug,
        doorSize: dlc.doorSize,
        drawerSize: dlc.drawerSize,
        drawerSolidColor: dlc.drawer ? null : dlc.solidColor,
      },
    };
  }
  const sourceKind = classifyFaceSource(style);
  const door = trimUrl(style?.doorSampleImageUrl) ?? trimUrl(style?.thumbnailImageUrl);
  const drawer = trimUrl(style?.drawerSampleImageUrl);
  if (sourceKind === "split") {
    return {
      sourceKind,
      doorUrl: door,
      drawerUrl: wall ? null : drawer,
      sections: wall ? 1 : 2,
      drawerTextureApplied: !wall && Boolean(drawer),
      grainRotation: 0,
    };
  }
  if (sourceKind === "none") {
    return {
      sourceKind,
      doorUrl: null,
      drawerUrl: null,
      sections: 1,
      drawerTextureApplied: false,
      grainRotation: 0,
    };
  }
  // One combined swatch is the only file. Door faces still use it, cropped to
  // the door band in the 3D renderer. Drawer faces use the same file, cropped
  // to the drawer band. A real door.png / drawer-front.png pair stays "split".
  if (sourceKind === "combined") {
    return {
      sourceKind,
      doorUrl: door,
      drawerUrl: wall ? null : door,
      sections: wall ? 1 : 2,
      drawerTextureApplied: !wall && Boolean(door),
      grainRotation: 0,
    };
  }
  return {
    sourceKind,
    doorUrl: door,
    drawerUrl: wall ? null : door,
    sections: 1,
    drawerTextureApplied: !wall && Boolean(door),
    grainRotation: 0,
  };
}

export type FramelessSplitPlan = {
  styleId: number;
  styleCode: string | null;
  name: string;
  action: "ready" | "skip" | "manual-review";
  reason: "ready" | "not-frameless" | "already-split" | "no-image" | "undetected";
  detection: RevealDetection | null;
};

export function planFramelessSplit(
  style: DoorStyleFaceInput & { id: number },
  detection: RevealDetection | null,
): FramelessSplitPlan {
  const name = style.ourName?.trim() || style.aliasName?.trim() || `Style #${style.id}`;
  const base = { styleId: style.id, styleCode: style.styleCode?.trim() || null, name, detection };
  if (!isFramelessDoorStyle(style)) return { ...base, action: "skip", reason: "not-frameless" };
  if (classifyFaceSource(style) === "split") return { ...base, action: "skip", reason: "already-split" };
  const source = trimUrl(style.doorSampleImageUrl) ?? trimUrl(style.thumbnailImageUrl);
  if (!source) return { ...base, action: "manual-review", reason: "no-image" };
  if (!detection?.detected) return { ...base, action: "manual-review", reason: "undetected" };
  return { ...base, action: "ready", reason: "ready" };
}

export type FaceImportRow = {
  code: string;
  name: string;
  collection: string;
  pdfPage: number | null;
  grainDirection: string | null;
  doorFile: string;
  drawerFile: string;
  revealRows: [number, number] | null;
  sourceNote: string;
};

export type CatalogFaceStyle = {
  id: number;
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  doorSampleImageUrl?: string | null;
};

export type ManifestImportPlan = {
  ready: Array<{
    row: FaceImportRow;
    styleId: number;
    styleCode: string | null;
    styleName: string;
    previousDoorUrl: string | null;
  }>;
  unmatched: FaceImportRow[];
  ambiguous: Array<{ row: FaceImportRow; styleIds: number[] }>;
  missingFiles: Array<{ row: FaceImportRow; missing: Array<"door" | "drawer"> }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pageOf(value: unknown): number | null {
  const page = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(page) && page > 0 ? page : null;
}

function revealOf(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const start = Number(value[0]);
  const end = Number(value[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return [start, end];
}

function importRowFromRaw(raw: Record<string, unknown>): FaceImportRow | null {
  const code = text(raw.code)?.toUpperCase() ?? null;
  const name = text(raw.name);
  if (!code || !name) return null;
  const folder = text(raw.folder)?.replace(/\\/g, "/").replace(/^\.?\//, "") ?? null;
  const doorFile = text(raw.doorFile) ?? text(raw.door_file) ?? (folder ? `${folder}/door.png` : null);
  const drawerFile = text(raw.drawerFile) ?? text(raw.drawer_file) ?? text(raw.drawer_front_file)
    ?? (folder ? `${folder}/drawer-front.png` : null);
  if (!doorFile || !drawerFile) return null;
  const pdfPage = pageOf(raw.pdfPage ?? raw.pdf_page);
  return {
    code,
    name,
    collection: text(raw.collection) ?? "",
    pdfPage,
    grainDirection: text(raw.grainDirection) ?? text(raw.grain_direction),
    doorFile: doorFile.replace(/\\/g, "/"),
    drawerFile: drawerFile.replace(/\\/g, "/"),
    revealRows: revealOf(raw.revealRows ?? raw.reveal_rows),
    sourceNote: text(raw.sourceNote) ?? uscdSourceNote(pdfPage),
  };
}

export function parseUscdManifest(input: unknown): { rows: FaceImportRow[]; errors: string[] } {
  const errors: string[] = [];
  const record = asRecord(input);
  const list = Array.isArray(input) ? input : Array.isArray(record?.styles) ? record.styles : null;
  if (!list) return { rows: [], errors: ["Manifest must be a styles array or { styles: [...] }."] };
  const rows: FaceImportRow[] = [];
  list.forEach((item, index) => {
    const raw = asRecord(item);
    const row = raw ? importRowFromRaw(raw) : null;
    if (!row) errors.push(`Row ${index + 1} is missing code, name, or door/drawer files.`);
    else rows.push(row);
  });
  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === "\"") {
      if (quoted && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/** CSV from the prepared USCD set: code, name, collection, pdf_page, folder, plus the rest. */
export function parseUscdManifestCsv(csv: string): { rows: FaceImportRow[]; errors: string[] } {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ["Manifest CSV has no data rows."] };
  const header = splitCsvLine(lines[0]!).map((cell) => cell.trim());
  const records = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const raw: Record<string, unknown> = {};
    header.forEach((key, index) => {
      raw[key] = cells[index] ?? "";
    });
    const revealStart = Number(raw.reveal_start);
    const revealEnd = Number(raw.reveal_end);
    if (Number.isFinite(revealStart) && Number.isFinite(revealEnd)) raw.reveal_rows = [revealStart, revealEnd];
    return raw;
  });
  return parseUscdManifest(records);
}

function namesMatch(style: CatalogFaceStyle, row: FaceImportRow): boolean {
  const wanted = row.name.trim().toLowerCase();
  const names = [style.ourName, style.aliasName].map((name) => name?.trim().toLowerCase() ?? "").filter(Boolean);
  return names.some((name) => name === wanted || name.endsWith(` ${wanted}`) || name.startsWith(`${wanted} `));
}

function fileReady(files: ReadonlySet<string> | undefined, path: string): boolean {
  if (!files) return true;
  const wanted = path.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
  for (const file of files) {
    const normal = file.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
    if (normal === wanted || normal.endsWith(`/${wanted}`)) return true;
  }
  return false;
}

/**
 * Dry-run matcher. Nothing is written. A row is ready only when one catalog
 * style matches by code (or by exact name when the code is empty on that style)
 * and both files are present. Ambiguous codes are listed, not applied.
 */
export function planUscdManifestImport(
  rows: readonly FaceImportRow[],
  catalog: readonly CatalogFaceStyle[],
  files?: ReadonlySet<string>,
): ManifestImportPlan {
  const plan: ManifestImportPlan = { ready: [], unmatched: [], ambiguous: [], missingFiles: [] };
  for (const row of rows) {
    const byCode = catalog.filter((style) => (style.styleCode ?? "").trim().toUpperCase() === row.code);
    const matches = byCode.length > 0
      ? byCode
      : catalog.filter((style) => !(style.styleCode ?? "").trim() && namesMatch(style, row));
    if (matches.length === 0) {
      plan.unmatched.push(row);
      continue;
    }
    if (matches.length > 1) {
      plan.ambiguous.push({ row, styleIds: matches.map((style) => style.id) });
      continue;
    }
    const missing: Array<"door" | "drawer"> = [];
    if (!fileReady(files, row.doorFile)) missing.push("door");
    if (!fileReady(files, row.drawerFile)) missing.push("drawer");
    if (missing.length > 0) {
      plan.missingFiles.push({ row, missing });
      continue;
    }
    const style = matches[0]!;
    plan.ready.push({
      row,
      styleId: style.id,
      styleCode: style.styleCode?.trim() || null,
      styleName: style.ourName?.trim() || style.aliasName?.trim() || `Style #${style.id}`,
      previousDoorUrl: trimUrl(style.doorSampleImageUrl),
    });
  }
  return plan;
}

export const TORINO_REFERENCE = {
  codes: ["TWP", "TGW", "TDW"] as const,
  grainDirection: "horizontal" as const,
  pdfPage: 2,
  sourceNote: "USCD Spec Manual V8.2, PDF p.2",
  drawerLastRow: 186,
  doorStartRow: 201,
  revealRows: [189, 198] as const,
} as const;
