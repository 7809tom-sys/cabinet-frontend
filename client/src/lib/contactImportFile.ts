import { parseCsvRecords } from "@shared/crmCustomerListImport";

export type SpreadsheetTable = { headers: string[]; rows: unknown[][] };

/** Reads a CSV or the first sheet of an XLSX/XLS file. The file never leaves the browser. */
export async function readContactSpreadsheet(file: File): Promise<SpreadsheetTable> {
  const name = file.name.toLowerCase();
  let records: unknown[][];
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.includes("csv")) {
    records = parseCsvRecords((await file.text()).replace(/^\uFEFF/, ""));
  } else {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("That workbook has no sheets.");
    records = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
  }
  const [headerRow, ...rows] = records;
  if (!headerRow) return { headers: [], rows: [] };
  return { headers: headerRow.map((cell) => String(cell ?? "").trim()), rows };
}
