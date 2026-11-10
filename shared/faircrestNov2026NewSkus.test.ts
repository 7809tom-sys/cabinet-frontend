import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../docs/sql/0275_faircrest_nov2026_new_skus.tidb.sql"),
  "utf8",
);

type ExpectedSku = {
  code: string;
  description: string;
  width: number;
  height: number;
  depth: number;
  doors: number | null;
  shelves: number | null;
  category: string;
  subCategory: string | null;
  cornerType?: string;
};

const EXPECTED: ExpectedSku[] = [
  { code: "W183024", description: '18" x 30" x 24" Wall Cabinet', width: 18, height: 30, depth: 24, doors: 1, shelves: null, category: "Wall", subCategory: null },
  { code: "W183624", description: '18" x 36" x 24" Wall Cabinet', width: 18, height: 36, depth: 24, doors: 1, shelves: null, category: "Wall", subCategory: null },
  { code: "W184224", description: '18" x 42" x 24" Wall Cabinet', width: 18, height: 42, depth: 24, doors: 1, shelves: null, category: "Wall", subCategory: null },
  { code: "W3DR18", description: '18" Three Drawer Cabinet', width: 18, height: 18, depth: 15, doors: null, shelves: null, category: "Wall", subCategory: null },
  { code: "W3DR24", description: '24" Three Drawer Cabinet', width: 24, height: 18, depth: 15, doors: null, shelves: null, category: "Wall", subCategory: null },
  { code: "WDC2430", description: '24" x 30" Diagonal Corner Wall Cabinet', width: 24, height: 30, depth: 12, doors: 1, shelves: 2, category: "Wall", subCategory: "Corner Wall", cornerType: "diagonal" },
  { code: "WDC2436", description: '24" x 36" Diagonal Corner Wall Cabinet', width: 24, height: 36, depth: 12, doors: 1, shelves: 2, category: "Wall", subCategory: "Corner Wall", cornerType: "diagonal" },
  { code: "WDC2442", description: '24" x 42" Diagonal Corner Wall Cabinet', width: 24, height: 42, depth: 12, doors: 1, shelves: 3, category: "Wall", subCategory: "Corner Wall", cornerType: "diagonal" },
  { code: "WOC3312PG", description: '33" x 12" Wall Cabinet w/Plain Glass Doors', width: 33, height: 12, depth: 24, doors: 2, shelves: null, category: "Wall", subCategory: "Plain Glass (PG) Wall" },
  { code: "UOC3384", description: '33" x 84" Universal Oven Cabinet', width: 33, height: 84, depth: 24, doors: 2, shelves: null, category: "Tall", subCategory: null },
  { code: "UOC3390", description: '33" x 90" Universal Oven Cabinet', width: 33, height: 90, depth: 24, doors: 2, shelves: null, category: "Tall", subCategory: null },
  { code: "UOC3396", description: '33" x 96" Universal Oven Cabinet', width: 33, height: 96, depth: 24, doors: 2, shelves: null, category: "Tall", subCategory: null },
  { code: "FFS24", description: '24" Finished Floating Shelf', width: 24, height: 2.5, depth: 10, doors: null, shelves: null, category: "Accessory", subCategory: null },
  { code: "FFS30", description: '30" Finished Floating Shelf', width: 30, height: 2.5, depth: 10, doors: null, shelves: null, category: "Accessory", subCategory: null },
  { code: "FFS36", description: '36" Finished Floating Shelf', width: 36, height: 2.5, depth: 10, doors: null, shelves: null, category: "Accessory", subCategory: null },
  { code: "FFS42", description: '42" Finished Floating Shelf', width: 42, height: 2.5, depth: 10, doors: null, shelves: null, category: "Accessory", subCategory: null },
  { code: "REP9624", description: "Refrigerator End Panel", width: 1.5, height: 96, depth: 24, doors: null, shelves: null, category: "Panels", subCategory: "Wall Refrigerator End Panel" },
  { code: "LVC", description: `2-5/8" Large Cove Crown Moulding, 8'`, width: 96, height: 2.625, depth: 2.5, doors: null, shelves: null, category: "Molding", subCategory: "Crown Moulding" },
];

function statements(source: string): string[] {
  const withoutComments = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments.split(";").map((part) => part.trim()).filter(Boolean);
}

function parseSqlValues(input: string): string[] {
  const values: string[] = [];
  let current = "";
  let quote: "'" | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === "'" && input[i + 1] === "'") {
        current += "'";
        i += 1;
        continue;
      }
      if (char === "'") {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }
    if (char === "'") {
      quote = "'";
      continue;
    }
    if (char === ",") {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) values.push(current.trim());
  return values;
}

function cabinetRows(): Map<string, Record<string, string>> {
  const rows = new Map<string, Record<string, string>>();
  for (const statement of statements(sql)) {
    if (!statement.startsWith("INSERT INTO cabinet_dealz.cabinets")) continue;
    const columns = statement.match(/\(([^)]+)\)\s+SELECT/i)?.[1];
    const values = statement.match(/SELECT\s+([\s\S]+?)\s+FROM DUAL/i)?.[1];
    if (!columns || !values) throw new Error(`Unparsed cabinet insert: ${statement.slice(0, 80)}`);
    const names = columns.split(",").map((name) => name.trim());
    const parsed = parseSqlValues(values);
    expect(parsed).toHaveLength(names.length);
    const row = Object.fromEntries(names.map((name, index) => [name, parsed[index] === "NULL" ? null : parsed[index]]));
    rows.set(String(row.masterCode), row as Record<string, string>);
  }
  return rows;
}

describe("Faircrest November 2026 new SKU migration", () => {
  const executable = statements(sql);

  it("is insert-only and skips a code that already exists", () => {
    expect(executable.some((statement) => /^\s*UPDATE\b/i.test(statement))).toBe(false);
    expect(executable.some((statement) => /^\s*DELETE\b/i.test(statement))).toBe(false);
    const cabinetInserts = executable.filter((statement) => statement.startsWith("INSERT INTO cabinet_dealz.cabinets"));
    expect(cabinetInserts).toHaveLength(18);
    for (const statement of cabinetInserts) {
      expect(statement).toMatch(/WHERE NOT EXISTS/i);
    }
  });

  it("inserts the 18 guide SKUs with their dimensions, doors, and shelves", () => {
    const rows = cabinetRows();
    expect([...rows.keys()].sort()).toEqual(EXPECTED.map((row) => row.code).sort());
    for (const expected of EXPECTED) {
      const row = rows.get(expected.code);
      expect(row, expected.code).toBeDefined();
      expect(row?.description).toBe(expected.description);
      expect(Number(row?.width)).toBe(expected.width);
      expect(Number(row?.height)).toBe(expected.height);
      expect(Number(row?.depth)).toBe(expected.depth);
      expect(row?.category).toBe(expected.category);
      expect(row?.subCategory ?? null).toBe(expected.subCategory);
      expect(row?.numberOfDoors == null ? null : Number(row.numberOfDoors)).toBe(expected.doors);
      expect(row?.numberOfAdjShelves == null ? null : Number(row.numberOfAdjShelves)).toBe(expected.shelves);
      if (expected.cornerType) expect(row?.cornerType).toBe(expected.cornerType);
    }
  });

  it("links each new code to existing door styles and leaves the price null", () => {
    const links = executable.filter((statement) => statement.startsWith("INSERT INTO cabinet_dealz.distributor_skus"));
    expect(links).toHaveLength(18);
    for (const expected of EXPECTED) {
      const link = links.find((statement) => statement.includes(`'${expected.code}'`));
      expect(link, expected.code).toBeDefined();
      expect(link).toMatch(/listPrice, yourCost\)/);
      expect(link).toMatch(/, 0, 0, NULL, NULL /);
      expect(link).not.toContain("template_sku.isAvailable");
      expect(link).toContain("faircrest_distributor.code)) = 'CS'");
      expect(link).toMatch(/WHERE NOT EXISTS/i);
    }
  });
});
