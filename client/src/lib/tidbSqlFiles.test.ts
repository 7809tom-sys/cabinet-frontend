import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TiDB Cloud's SQL editor rejects `ADD COLUMN IF NOT EXISTS`,
 * `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. Confirmed on
 * Tom's editor (PR 269): the whole file stopped on the first statement.
 *
 * So these files use plain DDL and say, in the header, that a "Duplicate column
 * name" / "already exists" error on a re-run is safe to skip. This test pins the
 * shape that makes a line pasteable on its own.
 */

const FILES = [
  "docs/sql/0227_distributor_order_email.tidb.sql",
  "docs/sql/0251_order_activity_log.tidb.sql",
  "docs/sql/0252_vendor_cost_factor.tidb.sql",
  "docs/sql/0253_designer_ready_override.tidb.sql",
  "docs/sql/0261_wall_wine_rack_publish.tidb.sql",
] as const;

function read(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

/** Split into statements, dropping comment-only and label lines. */
function statements(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => line.trim() && !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

describe.each(FILES)("%s", (path) => {
  const sql = read(path);
  const body = statements(sql);

  it("uses no IF NOT EXISTS, which TiDB Cloud rejects", () => {
    expect(sql).not.toMatch(/IF\s+NOT\s+EXISTS/i);
  });

  it("keeps its number and says one statement per line", () => {
    const number = /(\d{4})/.exec(path)?.[1];
    expect(sql).toContain(`Numbered ${number}`);
    expect(sql).toContain("One statement per line");
  });

  it("says a duplicate-column / already-exists error is safe to skip", () => {
    expect(sql).toMatch(/THAT ERROR IS SAFE/);
    expect(sql).toMatch(/Duplicate column name|already exists/);
    expect(sql).toMatch(/Skip[\s\S]{0,40}that one line/);
  });

  it("uses the cabinet_dealz prefix on every table it touches", () => {
    // Anchored to the keyword positions that are unambiguously followed by a
    // table name, so `ADD COLUMN x VARCHAR`, `SET ... ON UPDATE` and column
    // defaults are never mistaken for one.
    const PATTERNS = [
      /\bALTER TABLE\s+([a-zA-Z_][\w.]*)/gi,
      /\bCREATE TABLE\s+([a-zA-Z_][\w.]*)/gi,
      /\bCREATE INDEX\s+\w+\s+ON\s+([a-zA-Z_][\w.]*)/gi,
      /^UPDATE\s+([a-zA-Z_][\w.]*)/gi,
      /\bINSERT INTO\s+([a-zA-Z_][\w.]*)/gi,
      /\bFROM\s+(cabinet_dealz\.[\w]+|information_schema\.[\w]+)/gi,
    ];
    for (const statement of body) {
      for (const pattern of PATTERNS) {
        for (const match of statement.matchAll(pattern)) {
          const table = match[1];
          if (table.startsWith("information_schema.")) continue;
          expect(table.startsWith("cabinet_dealz."), `${statement.slice(0, 70)} -> ${table}`).toBe(true);
        }
      }
    }
  });

  it("has no table aliases in an UPDATE", () => {
    for (const statement of body.filter((entry) => /^UPDATE\b/i.test(entry))) {
      // "UPDATE cabinet_dealz.tbl SET ... WHERE ..." — no "AS x", no trailing alias.
      expect(statement, statement.slice(0, 80)).not.toMatch(/^UPDATE\s+\S+\s+(AS\s+)?[a-zA-Z_]\w*\s+SET/i);
      expect(statement).toMatch(/^UPDATE\s+cabinet_dealz\.\w+\s+SET/i);
    }
  });

  it("puts each CREATE TABLE on one line", () => {
    for (const statement of body.filter((entry) => /^CREATE TABLE\b/i.test(entry))) {
      const start = sql.indexOf(statement.slice(0, 40));
      expect(start).toBeGreaterThan(-1);
      // The matching line in the file is a single line.
      const line = sql.split("\n").find((entry) => entry.includes(statement.slice(20, 60)));
      expect(line, "CREATE TABLE must be one line").toBeTruthy();
      expect(line!.trim().endsWith(";")).toBe(true);
    }
  });

  it("has exactly one statement per non-comment line", () => {
    const lines = sql.split("\n").filter((line) => line.trim() && !line.trimStart().startsWith("--"));
    for (const line of lines) {
      // A line may end with ";" or be a continuation of nothing: every statement
      // starts at column 0 and ends with a semicolon.
      expect(line.startsWith(" "), `unexpected indentation: ${line.slice(0, 60)}`).toBe(false);
      expect(line.trim().endsWith(";"), `missing semicolon: ${line.slice(0, 60)}`).toBe(true);
      expect((line.match(/;/g) ?? []).length, `two statements on one line: ${line.slice(0, 60)}`).toBe(1);
    }
  });

  it("is read-only after the DDL: only SELECT verification queries", () => {
    const mutations = body.filter((entry) => /^(INSERT|DELETE|TRUNCATE|DROP)\b/i.test(entry));
    expect(mutations).toEqual([]);
  });

  it("ends with a verification query so a partial paste is visible", () => {
    expect(body.at(-1)).toMatch(/^SELECT\b/);
  });
});

describe("0227 specifically", () => {
  const sql = read("docs/sql/0227_distributor_order_email.tidb.sql");

  it("adds every column the status dots write", () => {
    for (const column of ["orderVerifiedAt", "orderVerifiedBy", "orderShippedAt", "orderShippedBy", "orderSignedAt", "orderSignedBy", "signerName", "shipmentCarrier", "shipmentTracking"]) {
      expect(sql).toContain(`ADD COLUMN ${column} `);
    }
  });

  it("creates the per-distributor table without IF NOT EXISTS", () => {
    expect(sql).toContain("CREATE TABLE cabinet_dealz.order_distributor_emails (");
  });
});

describe("0251 specifically", () => {
  const sql = read("docs/sql/0251_order_activity_log.tidb.sql");

  it("creates order_events and its index as separate plain statements", () => {
    expect(sql).toContain("CREATE TABLE cabinet_dealz.order_events (");
    expect(sql).toContain("CREATE INDEX order_events_order_created_idx ON cabinet_dealz.order_events (orderRequestId, createdAt);");
  });

  it("adds the PO sender to both tables", () => {
    expect(sql).toContain("ALTER TABLE cabinet_dealz.order_requests ADD COLUMN distributorEmailSentBy VARCHAR(255) NULL;");
    expect(sql).toContain("ALTER TABLE cabinet_dealz.order_distributor_emails ADD COLUMN distributorEmailSentBy VARCHAR(255) NULL;");
  });
});

describe("0253 specifically", () => {
  const sql = read("docs/sql/0253_designer_ready_override.tidb.sql");

  it("stores the override as a nullable VARCHAR so both directions are expressible", () => {
    expect(sql).toContain("ADD COLUMN designerReadyOverride VARCHAR(16) NULL;");
  });

  it("stores the back-in-stock value as a DATE, not a timestamp", () => {
    expect(sql).toContain("ADD COLUMN designerOffUntil DATE NULL;");
  });

  it("says a re-run's duplicate-column error is safe", () => {
    expect(sql).toContain("Duplicate column name");
  });
});
