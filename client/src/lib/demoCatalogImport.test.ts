import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_CSV_COLUMNS, importCatalogCsv, parseCsv, summarizeImport, formatElapsed } from "./demoCatalogImport";
import { DEMO_LINES, productsForLine } from "./demoDistributor";

const sample = readFileSync(resolve(__dirname, "../../public/demo/distributor-catalog-sample.csv"), "utf8");

describe("demo spreadsheet catalog import", () => {
  it("ships a sample file of real demo-catalog codes for the three lines", () => {
    const table = parseCsv(sample);
    expect(table[0]).toEqual([...SAMPLE_CSV_COLUMNS]);
    const result = importCatalogCsv(sample);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(189);
    const s = summarizeImport(result.rows);
    expect(s.lines.map((l) => l.name)).toEqual(DEMO_LINES.map((l) => l.name));
    expect(s.doorStyleCount).toBe(3);
    for (const line of DEMO_LINES) {
      const codes = new Set(productsForLine(line.id).map((p) => p.sku));
      for (const r of result.rows.filter((x) => x.line === line.name)) expect(codes.has(r.code), r.code).toBe(true);
    }
  });

  it("reports bad rows without crashing", () => {
    const csv = [
      "line,door_style,code,width,price,group",
      "White Shaker,Shaker White,B24,24,250,Bases",
      ",Shaker White,B30,30,260,Bases",
      "White Shaker,Shaker White,W3030,thirty,1,Walls",
      "White Shaker,Shaker White,B24,24,250,Bases",
      "White Shaker,Shaker White,X1,1,1,Roofs",
      '"White Shaker","Shaker White","SB36","36","$310.50","Bases"',
    ].join("\r\n");
    const r = importCatalogCsv(csv);
    expect(r.rows.map((x) => x.code)).toEqual(["B24", "SB36"]);
    expect(r.rows[1].price).toBe(310.5);
    expect(r.errors.map((e) => e.rowNumber)).toEqual([3, 4, 5, 6]);
    expect(r.errors[2].reason).toContain("duplicate");
    expect(importCatalogCsv("foo,bar\n1,2").missingColumns).toEqual(["line", "door_style", "code"]);
    expect(importCatalogCsv("").errors).toHaveLength(1);
    expect(formatElapsed(18234)).toBe("18.2 s");
  });
});
