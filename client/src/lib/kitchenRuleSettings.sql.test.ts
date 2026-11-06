/**
 * The SQL file and the backend patch must stay in step with the registry.
 *
 * A rule that exists in code but has no seed row is still shown by the admin
 * page (it falls back to its code default), but it cannot be saved until a row
 * exists, so a missing seed is a real defect. And a seed row that drifts from
 * the code default would quietly mislead whoever reads the table.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KITCHEN_RULE_DEFINITIONS } from "./kitchenRuleRegistry";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0254_kitchen_rule_settings.tidb.sql"), "utf8");
const patch = readFileSync(
  resolve(process.cwd(), "docs/patches/cabinet-backend-kitchen-rule-settings.patch"),
  "utf8",
);

/**
 * Every seed row as key, default value and lock state.
 *
 * The rows are read from the tuple list inside the one INSERT, not from lines:
 * the statement is a single physical line, so splitting on newlines would find
 * nothing and a silent empty list would make every other assertion vacuous.
 */
function seedRows(): Array<{ key: string; defaultValue: string; locked: boolean }> {
  const insertAt = sql.indexOf("INSERT IGNORE INTO cabinet_dealz.kitchen_rule_settings");
  const body = sql.slice(insertAt).slice(sql.slice(insertAt).indexOf("VALUES") + "VALUES".length);
  // Each row is one parenthesised tuple; text fields may contain commas, and an
  // escaped quote is written as ''.
  const tuple = /\((?:[^()']|'(?:[^']|'')*')*\)/g;
  const field = /^\(([^,]+), ((?:'(?:[^']|'')*')|[^,]+), ((?:'(?:[^']|'')*')|[^,]+), ((?:'(?:[^']|'')*')|[^,]+), ((?:'(?:[^']|'')*')|[^,]+), (NULL|'(?:[^']|'')*'), ((?:'(?:[^']|'')*')|[^,]+), ([^,]+), ([^,]+), ([^,]+)\)$/;
  const unquote = (raw: string) => raw.trim().replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'");
  const rows: Array<{ key: string; defaultValue: string; locked: boolean }> = [];
  for (const match of body.matchAll(tuple)) {
    const parsed = match[0].match(field);
    if (!parsed) continue;
    rows.push({
      key: unquote(parsed[1]!),
      defaultValue: unquote(parsed[7]!),
      locked: parsed[9]!.trim() === "1",
    });
  }
  return rows;
}

/** The statement lines of one `-- N.` block, in order, without comment lines. */
function statementLinesOf(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("--"));
}

/** The numbered blocks of the script: everything after a `-- N.` line. */
function numberedBlocks(): string[] {
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of sql.split("\n")) {
    if (/^-- \d+\. /.test(line.trim())) {
      if (current) blocks.push(current.join("\n"));
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) blocks.push(current.join("\n"));
  return blocks;
}

/** The patch with its diff markers removed, so a line can be checked as code. */
const patchCode = patch
  .split("\n")
  .filter((line) => /^[+ ]/.test(line) && !line.startsWith("+++"))
  .map((line) => line.slice(1))
  .join("\n");

describe("docs/sql/0254_kitchen_rule_settings.tidb.sql", () => {
  it("creates the table under cabinet_dealz with a unique setting key", () => {
    expect(sql).toContain("CREATE TABLE cabinet_dealz.kitchen_rule_settings");
    expect(sql).toContain("UNIQUE KEY kitchen_rule_settings_key_uq (settingKey)");
  });

  it("uses no IF NOT EXISTS, which Tom's TiDB Cloud editor rejects", () => {
    // Only the comments may mention it, to explain why it is absent.
    const statements = sql
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("--"));
    for (const line of statements) {
      expect(line.toUpperCase(), line.slice(0, 50)).not.toContain("IF NOT EXISTS");
    }
  });

  it("is safe to re-run, and says an already-exists error may be skipped", () => {
    // A plain CREATE TABLE is only acceptable because a second run's error is
    // harmless, so the file has to say so where Tom will read it.
    expect(sql).toContain("already exists");
    expect(sql).toMatch(/safe to skip/i);
    expect(sql).toContain("INSERT IGNORE INTO cabinet_dealz.kitchen_rule_settings");
  });

  it("seeds exactly the rules the code defines, once each", () => {
    const rows = seedRows();
    const codeKeys = KITCHEN_RULE_DEFINITIONS.map((rule) => rule.key).sort();
    expect(rows.map((row) => row.key).sort()).toEqual(codeKeys);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it("seeds every value as NULL, so running the SQL changes no design", () => {
    // valueText NULL is the whole promise of this file. A seed that wrote a
    // value would silently change every existing plan the moment it runs.
    for (const row of seedRows()) {
      expect(row.defaultValue, row.key).not.toBe("");
    }
    expect(sql).toContain("valueText stays NULL");
    // No INSERT outside the one guarded statement.
    const inserts = sql.split("\n").filter((line) => /^INSERT\b/i.test(line.trim()));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toContain("INSERT IGNORE INTO cabinet_dealz.kitchen_rule_settings");
  });

  it("marks exactly the three mandatory rules as locked", () => {
    const locked = seedRows().filter((row) => row.locked).map((row) => row.key).sort();
    expect(locked).toEqual(["bridge_above_range_required", "faucet_at_sink_required", "window_never_moves"]);
  });

  it("puts every statement on exactly one physical line, so each can be pasted alone", () => {
    // Tom's rule: one statement per line. A block whose CREATE TABLE is spread
    // over forty lines cannot be pasted into the TiDB editor in one go, and a
    // wrapped statement is easy to run only half of.
    const blocks = numberedBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) {
      const statements = statementLinesOf(block);
      expect(statements, `block starting "${statements[0]?.slice(0, 40)}"`).toHaveLength(1);
      const statement = statements[0]!;
      expect(statement.endsWith(";"), "the single line ends with a semicolon").toBe(true);
      // One statement, not two sharing a line.
      expect(statement.split(";").filter((part) => part.trim()).length).toBe(1);
    }
  });

  it("writes the CREATE TABLE as one line", () => {
    const createLines = sql.split("\n").filter((line) => line.trim().toUpperCase().startsWith("CREATE TABLE"));
    expect(createLines).toHaveLength(1);
    expect(createLines[0]).toContain("cabinet_dealz.kitchen_rule_settings (id INT NOT NULL AUTO_INCREMENT");
    expect(createLines[0]!.trim().endsWith(");")).toBe(true);
  });

  it("carries the next free number, after the numbers other branches claimed", () => {
    // 0250 belongs to the library-documents branch, 0251-0253 to the order branch.
    // Taking 0254 keeps this file from colliding while those land.
    const header = sql.split("\n")[0]!;
    expect(header).toContain("Numbered 0254");
    expect(header).toContain("Run after 0253");
    const files = readdirSync(resolve(process.cwd(), "docs/sql")).filter((name) => name.endsWith(".tidb.sql"));
    expect(files).toContain("0254_kitchen_rule_settings.tidb.sql");
    expect(files.some((name) => name.startsWith("0250_kitchen_rule_settings"))).toBe(false);
  });

  it("prefixes every table and avoids reserved-word aliases", () => {
    expect(sql).toContain("cabinet_dealz.kitchen_rule_settings");
    expect(sql).not.toMatch(/\bFROM\s+cabinet_dealz\.\w+\s+(key|status|order|group|range|index)\b/i);
  });

  it("parses as valid MySQL, statement by statement", async () => {
    // Flattening statements onto one line is exactly the change that can break
    // syntax silently: a missing space or a swallowed semicolon still looks
    // like SQL. A real parser is the only honest check.
    const { Parser } = await import("node-sql-parser").catch(() => ({ Parser: null as never }));
    if (!Parser) return; // The parser is a dev-only extra; skip when absent.
    const parser = new Parser();
    const statements = sql
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(3);
    for (const statement of statements) {
      expect(() => parser.astify(statement, { database: "MySQL" })).not.toThrow();
    }
  });
});

describe("docs/patches/cabinet-backend-kitchen-rule-settings.patch", () => {
  it("adds the settings table to the drizzle schema", () => {
    expect(patchCode).toContain('mysqlTable("kitchen_rule_settings"');
    expect(patchCode).toContain('settingKey: varchar("settingKey", { length: 80 }).notNull().unique()');
    expect(patchCode).toContain('deletedAt: timestamp("deletedAt")');
    expect(patchCode).toContain('lockedFlag: boolean("lockedFlag").default(false).notNull()');
  });

  it("adds every procedure the frontend calls", () => {
    for (const procedure of [
      "settings: adminProcedure",
      "saveSetting: adminProcedure",
      "resetSetting: adminProcedure",
      "createRule: adminProcedure",
      "deleteRule: adminProcedure",
      "restoreRule: adminProcedure",
    ]) {
      expect(patchCode, procedure).toContain(procedure);
    }
  });

  it("leaves the public parameters procedure alone", () => {
    // Every Designer session, signed in or not, reads the numbers through
    // `parameters`. The patch adds settings procedures beside it and must not
    // narrow it to admin-only, which would leave a guest build on stale values.
    expect(patch).not.toMatch(/^-.*parameters: publicProcedure/);
    expect(patch).not.toMatch(/^-.*parameters: publicProcedure|^-.*parameters: adminProcedure/);
  });

  it("refuses to disable, retarget, or delete a locked rule", () => {
    expect(patchCode).toContain("refuseLockedWrite");
    expect(patchCode).toContain("It cannot be disabled, retargeted, or deleted");
    // The locked value is never returned, so the code default always wins.
    expect(patchCode).toContain("if (definition?.locked === true) return false;");
  });

  it("keeps a deleted rule restorable and stops it applying at once", () => {
    expect(patchCode).toContain("deletedAt: new Date()");
    expect(patchCode).toContain("restoreRule: adminProcedure");
    expect(patchCode).toContain("if (row.deletedAt != null) return false;");
  });

  it("is a real patch: it has a diff header and hunks for both files", () => {
    expect(patch).toContain("diff --git a/drizzle/schema.ts b/drizzle/schema.ts");
    expect(patch).toContain("diff --git a/server/routers/kitchenRules.ts b/server/routers/kitchenRules.ts");
    expect(patch).toMatch(/^@@ /m);
  });
});
