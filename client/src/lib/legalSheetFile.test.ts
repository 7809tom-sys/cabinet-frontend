import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { sheetFromArrayBuffer } from "./legalSheetFile";

describe("warranty spreadsheet upload", () => {
  it("reads an xlsx sheet into rows without touching warranty prose", () => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["SKU", "Warranty term"],
      ["ABC-1", "5 year limited"],
    ]);
    XLSX.utils.book_append_sheet(book, sheet, "Warranties");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as Uint8Array;
    const parsed = sheetFromArrayBuffer(bytes, "cabinet-warranties.xlsx");
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.headers).toEqual(["SKU", "Warranty term"]);
    expect(parsed.rows).toEqual([["ABC-1", "5 year limited"]]);
  });
});
