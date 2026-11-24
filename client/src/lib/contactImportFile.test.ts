import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readContactSpreadsheet } from "./contactImportFile";
import { guessContactColumnMapping, planContactImport } from "@shared/crmContactImport";

function fileFrom(data: BlobPart, name: string, type = ""): File {
  return new File([data], name, { type });
}

describe("readContactSpreadsheet", () => {
  it("reads a CSV with a BOM and quoted commas", async () => {
    const table = await readContactSpreadsheet(fileFrom('\uFEFFName,Email,City\n"Doe, Jane",jane@example.com,Concord\n', "list.csv", "text/csv"));
    expect(table.headers).toEqual(["Name", "Email", "City"]);
    expect(table.rows).toEqual([["Doe, Jane", "jane@example.com", "Concord"]]);
  });

  it("reads the first sheet of an XLSX file", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([["First Name", "Last Name", "Email Address", "State"], ["Jane", "Doe", "JANE@example.com", "NH"]]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Customers");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const table = await readContactSpreadsheet(fileFrom(bytes, "list.xlsx"));
    const plan = planContactImport(table.rows, guessContactColumnMapping(table.headers));
    expect(plan.valid[0]).toMatchObject({ name: "Jane Doe", email: "jane@example.com", state: "NH", rowNumber: 2 });
  });
});
