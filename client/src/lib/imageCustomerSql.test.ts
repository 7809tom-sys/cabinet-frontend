import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0228_image_customer_link.tidb.sql"), "utf8");

describe("SQL 0228 image customer link", () => {
  it("keeps one statement per numbered block and qualifies every table", () => {
    expect(sql).not.toMatch(/statement-breakpoint/);
    expect(sql).toContain("SQL 0227");
    expect(sql).toContain("imageGeneratedCount");
    expect(sql).toContain("lastImageGeneratedAt");
    const blocks = sql.split(/\n-- \d+/).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(17);
    for (const block of blocks) {
      const statements = block
        .split(";")
        .map((part) => part.replace(/--[^\n]*/g, "").trim())
        .filter(Boolean);
      expect(statements).toHaveLength(1);
      if (/^\s*(ALTER|CREATE|SELECT)/i.test(statements[0])) {
        expect(statements[0]).toMatch(/cabinet_dealz\./);
      }
    }
    expect(sql.trimEnd().endsWith(";")).toBe(true);
    expect(sql).toContain("information_schema");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS cabinet_dealz.image_generation_ledger");
    expect(sql).not.toMatch(/\bAS (count|order|key|value|status|table)\b/i);
  });
});
