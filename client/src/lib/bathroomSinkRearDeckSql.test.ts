import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 0259 is Tom's preview-then-update script for the bathroom rear-deck report.
 *
 * The reported case turned out to be a CODE bug, not bad catalog data, so the
 * script's job is to let Tom confirm that with SELECTs before changing anything.
 * These assertions pin the paste-safe shape the other TiDB files use, and make
 * sure the one UPDATE stays guarded so a second run is a no-op.
 */
const PATH = "docs/sql/0259_bathroom_sink_rear_deck_audit.tidb.sql";

const sql = readFileSync(new URL(`../../../${PATH}`, import.meta.url), "utf8");

function statements(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => line.trim() && !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

describe(PATH, () => {
  const body = statements(sql);

  it("keeps its number and says one statement per line", () => {
    expect(sql).toContain("Numbered 0259");
    expect(sql).toContain("One statement per line");
  });

  for (const forbidden of [/IF\s+NOT\s+EXISTS/i, /\bDELETE\b/i, /\bDROP\b/i, /\bTRUNCATE\b/i]) {
    it(`avoids ${forbidden.source}`, () => {
      expect(sql).not.toMatch(forbidden);
    });
  }

  it("uses the cabinet_dealz prefix on every table", () => {
    for (const statement of body) {
      for (const match of statement.matchAll(/\bFROM\s+([a-zA-Z_][\w.]*)/gi)) {
        expect(match[1]!.startsWith("cabinet_dealz."), statement.slice(0, 60)).toBe(true);
      }
      for (const match of statement.matchAll(/^UPDATE\s+([a-zA-Z_][\w.]*)/gi)) {
        expect(match[1]!.startsWith("cabinet_dealz."), statement.slice(0, 60)).toBe(true);
      }
    }
  });

  it("has exactly one statement per line, starting at column 0", () => {
    const lines = sql.split("\n").filter((line) => line.trim() && !line.trimStart().startsWith("--"));
    for (const line of lines) {
      expect(line.startsWith(" "), `unexpected indentation: ${line.slice(0, 60)}`).toBe(false);
      expect(line.trim().endsWith(";"), `missing semicolon: ${line.slice(0, 60)}`).toBe(true);
      expect((line.match(/;/g) ?? []).length, `two statements: ${line.slice(0, 60)}`).toBe(1);
    }
  });

  it("previews before it updates, and only ever updates PL-3099's wrong size", () => {
    const firstUpdate = body.findIndex((entry) => /^UPDATE\b/i.test(entry));
    expect(firstUpdate).toBeGreaterThan(0);
    // Every statement before the update is a read.
    for (const statement of body.slice(0, firstUpdate)) expect(statement).toMatch(/^SELECT\b/i);
    const updates = body.filter((entry) => /^UPDATE\b/i.test(entry));
    expect(updates).toHaveLength(1);
    // Guarded on the old value, so re-running the file changes no row.
    expect(updates[0]).toContain("WHERE pelicanCode = 'PL-3099 Bone' AND size = '18\" x 13\"'");
  });

  it("says plainly that the reported case needed no data fix", () => {
    expect(sql).toMatch(/NO UPDATE IS REQUIRED/);
  });

  it("ends with a verification query", () => {
    expect(body.at(-1)).toMatch(/^SELECT\b/);
  });
});
