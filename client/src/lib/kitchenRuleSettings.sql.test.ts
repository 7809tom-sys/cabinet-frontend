/**
 * The SQL file and the backend patch must stay in step with the registry.
 *
 * A rule that exists in code but has no seed row is still shown by the admin
 * page (it falls back to its code default), but it cannot be saved until a row
 * exists, so a missing seed is a real defect. And a seed row that drifts from
 * the code default would quietly mislead whoever reads the table.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KITCHEN_RULE_DEFINITIONS } from "./kitchenRuleRegistry";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0250_kitchen_rule_settings.tidb.sql"), "utf8");
const patch = readFileSync(
  resolve(process.cwd(), "docs/patches/cabinet-backend-kitchen-rule-settings.patch"),
  "utf8",
);

/** Every seed row as [settingKey, defaultValueText, locked]. */
function seedRows(): Array<{ key: string; defaultValue: string; locked: boolean }> {
  const rows: Array<{ key: string; defaultValue: string; locked: boolean }> = [];
  for (const line of sql.split("\n")) {
    // The last row ends with `);`, every other row with `),`.
    const match = line.match(/^\('([a-z0-9_]+)', '.*', '.*', '.*', '(?:number|toggle|text|choice)', NULL, '(.*)', 1, ([01]), 1\)[,;]$/);
    if (!match) continue;
    rows.push({ key: match[1]!, defaultValue: match[2]!, locked: match[3] === "1" });
  }
  return rows;
}

/** The patch with its diff markers removed, so a line can be checked as code. */
const patchCode = patch
  .split("\n")
  .filter((line) => /^[+ ]/.test(line) && !line.startsWith("+++"))
  .map((line) => line.slice(1))
  .join("\n");

describe("docs/sql/0250_kitchen_rule_settings.tidb.sql", () => {
  it("creates the table under cabinet_dealz with a unique setting key", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS cabinet_dealz.kitchen_rule_settings");
    expect(sql).toContain("UNIQUE KEY kitchen_rule_settings_key_uq (settingKey)");
  });

  it("is safe to re-run", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS");
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

  it("uses one statement per numbered block, all one line", () => {
    const blocks = sql.split(/\n-- \d+\. /).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) {
      const statements = block
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("--"))
        .join(" ")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean);
      expect(statements).toHaveLength(1);
    }
  });

  it("prefixes every table and avoids reserved-word aliases", () => {
    expect(sql).toContain("cabinet_dealz.kitchen_rule_settings");
    expect(sql).not.toMatch(/\bFROM\s+cabinet_dealz\.\w+\s+(key|status|order|group|range|index)\b/i);
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
