import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REFERENCE_LIBRARY_CATEGORIES, REFERENCE_NAME_PATTERNS } from "./libraryVisibility";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0273_library_reference_documents.tidb.sql"), "utf8");

function sqlStatements(source: string): string[] {
  return source
    .split(/\n-- \d+\./)
    .slice(1)
    .map((block) =>
      block
        .split("\n")
        .slice(1)
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

const STATEMENTS = sqlStatements(sql);

describe("SQL 0273 reference documents", () => {
  it("is one statement per line, schema-qualified, with no IF NOT EXISTS", () => {
    expect(sql).toContain("Numbered 0273");
    expect(sql).toContain("One statement per line");
    expect(sql).not.toMatch(/statement-breakpoint/);
    for (const statement of STATEMENTS) {
      expect(statement).not.toMatch(/IF NOT EXISTS/i);
      if (statement.includes("information_schema")) {
        expect(statement).toContain("table_schema = 'cabinet_dealz'");
      } else {
        expect(statement).toMatch(/cabinet_dealz\./);
      }
      expect(statement.split(";").map((part) => part.trim()).filter(Boolean)).toHaveLength(1);
    }
    expect(sql.trimEnd().endsWith(";")).toBe(true);
  });

  it("previews the rows the rule would mark before it updates them", () => {
    const previewAt = STATEMENTS.findIndex((statement) => /^SELECT\b/.test(statement) && statement.includes("literatureId"));
    const updateAt = STATEMENTS.findIndex((statement) => /^UPDATE\b/.test(statement));
    expect(previewAt).toBeGreaterThan(0);
    expect(updateAt).toBeGreaterThan(previewAt);
    expect(STATEMENTS[0]).toMatch(/^ALTER TABLE cabinet_dealz\.affiliate_literature ADD COLUMN documentRole VARCHAR\(16\) NOT NULL DEFAULT 'literature';$/);
    expect(STATEMENTS[previewAt]).toContain("category IN ('Product Catalogs', 'Installation')");
    expect(STATEMENTS[updateAt]).toContain("SET documentRole = 'reference'");
    expect(STATEMENTS[updateAt]).toContain("IF(affiliateToggledAt IS NULL, 0, isPublished)");
    expect(STATEMENTS[updateAt]).toContain("IF(affiliateToggledAt IS NULL, 'internal', visibility)");
    expect(STATEMENTS[updateAt]).not.toMatch(/\bAS\b/i);
  });

  it("uses the same category and name rule as the shared helper", () => {
    for (const category of REFERENCE_LIBRARY_CATEGORIES) {
      expect(sql).toContain(`'${category}'`);
    }
    // Sales & Marketing and Training are literature. The UPDATE must not name them.
    expect(sql).not.toContain("'Sales & Marketing'");
    expect(sql).not.toContain("'Training'");
    for (const rule of REFERENCE_NAME_PATTERNS) {
      const compact = rule.label.replace(/\s+/g, "");
      expect(sql.toLowerCase()).toContain(`%${rule.label}%`);
      if (compact !== rule.label) expect(sql.toLowerCase()).toContain(`%${compact}%`);
    }
    // The description is not a column in the WHERE. A brochure can mention a catalog.
    expect(STATEMENTS.find((statement) => statement.startsWith("UPDATE"))).not.toMatch(/\bdescription\b/i);
  });

  it("ships a backend patch that enforces the rule inside publishedLiterature", () => {
    const patch = readFileSync(resolve(process.cwd(), "docs/patches/cabinet-backend-library-reference-documents.patch"), "utf8");
    expect(patch.startsWith("From: Cursor Agent")).toBe(true);
    expect(patch).toContain("isAffiliateLibraryDocument");
    expect(patch).toContain("affiliateToggledAt");
    expect(patch).toContain("reference: z.boolean().default(false)");
    expect(patch).toContain('documentRole: varchar("documentRole"');
    expect(patch).toContain("keeps a reference document off the affiliate list until the owner ticks it");
    expect(patch).toContain("isAffiliateLibraryDocument");
    expect(patch).not.toMatch(/\bTODO\b|\bFIXME\b/);
    const files = [...patch.matchAll(/^diff --git a\/(\S+) b\//gm)].map((match) => match[1]);
    expect(files).toContain("server/routers/affiliateResources.ts");
    expect(files).toContain("server/routers/affiliateLiterature.ts");
    expect(files).toContain("shared/libraryVisibility.ts");
    expect(files).toContain("docs/sql/0273_library_reference_documents.tidb.sql");
  });

  it("does not publish anything and does not clear the audit", () => {
    const update = STATEMENTS.find((statement) => statement.startsWith("UPDATE"))!;
    expect(update).not.toMatch(/affiliateToggledAt\s*=/);
    expect(update).not.toMatch(/affiliateToggledBy/);
    expect(update).not.toContain("'affiliate'");
    expect(sql).toContain("documentRole <> 'reference' OR affiliateToggledAt IS NOT NULL");
    expect(sql).toContain("Duplicate column name");
  });
});
