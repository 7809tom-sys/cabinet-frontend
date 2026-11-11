import * as XLSX from "xlsx";
import { parseCsvTable, sheetFromRows, type LegalSheet } from "@shared/legalPages";

const TEXT_TYPES = new Set(["text/plain", "text/csv", "application/csv"]);

export function sheetFromArrayBuffer(data: ArrayBuffer | Uint8Array, fileName: string): LegalSheet | { error: string } {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = new TextDecoder().decode(bytes);
    return parseCsvTable(text);
  }
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return { error: "Use a CSV or Excel spreadsheet for the warranty sheet." };
  }
  const book = XLSX.read(bytes, { type: "array" });
  const first = book.SheetNames[0];
  if (!first) return { error: "The spreadsheet has no sheet." };
  const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(book.Sheets[first], {
    header: 1,
    raw: false,
    defval: "",
  });
  const rows = grid.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
  const [headers, ...body] = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (!headers) return { error: "The spreadsheet has no rows." };
  return sheetFromRows(headers.map((cell) => cell.trim()), body);
}

export function isSpreadsheetName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

export function isLegalDocumentName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".txt") || isSpreadsheetName(fileName);
}

export function textType(mimeType: string, fileName: string): boolean {
  return TEXT_TYPES.has(mimeType) || fileName.toLowerCase().endsWith(".txt");
}
