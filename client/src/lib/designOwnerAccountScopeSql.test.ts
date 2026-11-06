import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0249_design_owner_account_scope.tidb.sql"), "utf8");

/** Each numbered block must hold exactly one statement, comments stripped. */
function numberedBlocks(text: string): string[][] {
  return text
    .split(/\n-- \d+\./)
    .slice(1)
    .map((block) => {
      // The split keeps the rest of the heading line, which is itself comment
      // text; drop it before looking for statements.
      const body = block.slice(block.indexOf("\n"));
      return body
        .split(";")
        .map((part) => part.replace(/--[^\n]*/g, "").trim())
        .filter(Boolean);
    });
}

describe("SQL 0249 design owner account scope", () => {
  it("keeps one statement per numbered block and qualifies every table", () => {
    expect(sql).toContain("Numbered 0249");
    expect(sql).toContain("Run after 0248");
    const blocks = numberedBlocks(sql);
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    for (const statements of blocks) {
      expect(statements).toHaveLength(1);
      expect(statements[0]).toMatch(/cabinet_dealz\./);
    }
    expect(sql.trimEnd().endsWith(";")).toBe(true);
  });

  it("is read-only apart from the single correction Tom must approve", () => {
    const statements = numberedBlocks(sql).map((block) => block[0]!);
    const writes = statements.filter((statement) => /^\s*(UPDATE|DELETE|INSERT|ALTER|DROP|TRUNCATE)\b/i.test(statement));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^UPDATE cabinet_dealz\.kitchen_designs/i);
    // The one write must be flagged, both up front and in its own block.
    expect(sql).toContain("DO NOT RUN WITHOUT TOM'S APPROVAL");
    expect(sql).toContain("Sections 1-4 are READ-ONLY previews");
    // It re-files the store only. Ownership is never reassigned by SQL.
    expect(writes[0]).toContain("SET saved_design.affiliateId = NULL");
    // Ownership is never reassigned: the SET list names the store column only.
    const setList = writes[0].match(/SET([\s\S]*?)\nWHERE/i)![1]!;
    expect(setList).toContain("saved_design.affiliateId = NULL");
    expect(setList).not.toMatch(/userId\s*=/i);
  });

  it("gives Tom a preview SELECT for the named design before any correction", () => {
    const preview = numberedBlocks(sql)[0]![0]!;
    expect(preview).toMatch(/^SELECT/);
    expect(preview).toContain("LIKE '%Maple Life%'");
    // The preview must show both halves of the answer.
    expect(preview).toContain("ownerUserId");
    expect(preview).toContain("affiliateId");
    expect(preview).toContain("affiliateSlug");
  });

  it("never treats a store's own team or its customers as mis-filed", () => {
    expect(sql).toContain("cabinet_dealz.affiliate_team_members");
    expect(sql).toContain("owner_user.signupAffiliateId <> saved_design.affiliateId");
    // The exclusion repeats in the correction, so approving it cannot widen it.
    const correction = numberedBlocks(sql).find((block) => /^UPDATE /i.test(block[0]!))![0]!;
    expect(correction).toContain("NOT EXISTS");
    expect(correction).toContain("team_member.isActive = 1");
  });

  it("says the schema needs no change for the fix itself", () => {
    expect(sql).toContain("no ALTER TABLE is required");
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS/);
  });
});
