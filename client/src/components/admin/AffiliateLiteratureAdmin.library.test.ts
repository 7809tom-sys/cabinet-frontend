import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const SQL_FILE = "docs/sql/0255_library_internal_documents.tidb.sql";
const PDF_FILE = "docs/library/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf";
const PATCH_FILE = "docs/patches/cabinet-backend-library-internal-documents.patch";

const sql = read(SQL_FILE);
const admin = read("client/src/components/admin/AffiliateLiteratureAdmin.tsx");
const patch = read(PATCH_FILE);
const html = read("client/index.html");

/**
 * The SQL file's numbered statements, without comments. The label line
 * ("-- 5. ...") is consumed by the split, so its remainder is dropped too.
 */
function sqlStatements(source: string): string[] {
  const blocks = source.split(/\n-- \d+\./).slice(1);
  return blocks.map((block) => {
    const withoutLabel = block.split("\n").slice(1).join("\n");
    return withoutLabel
      .split("\n")
      .map((line) => (line.trimStart().startsWith("--") ? "" : line))
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();
  });
}

const STATEMENTS = sqlStatements(sql);

describe("SQL 0255 library internal documents", () => {
  it("keeps one statement per numbered line and qualifies every table", () => {
    expect(sql).not.toMatch(/statement-breakpoint/);
    expect(sql).toContain("Numbered 0255");
    expect(sql).toContain("Run after 0254");
    expect(STATEMENTS.length).toBeGreaterThanOrEqual(12);
    for (const block of STATEMENTS) {
      // One statement per numbered line: exactly one trailing semicolon.
      const statements = block.split(";").map((part) => part.trim()).filter(Boolean);
      expect(statements).toHaveLength(1);
      if (/^\s*(ALTER|CREATE|SELECT|UPDATE|INSERT)\b/i.test(statements[0])) {
        if (/^SELECT\b/i.test(statements[0]) && statements[0].includes("information_schema")) continue;
        expect(statements[0]).toMatch(/cabinet_dealz\./);
      }
    }
    expect(sql.trimEnd().endsWith(";")).toBe(true);
    expect(sql).toContain("information_schema");
  });

  it("puts the visibility column first and standalone, before anything reads it", () => {
    // TiDB Cloud rejected ADD COLUMN IF NOT EXISTS, so visibility was never
    // added and every later statement died on "Unknown column 'visibility'".
    expect(STATEMENTS[0]).toBe(
      "ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'internal';",
    );
    // Nothing else may read the column before it exists.
    const firstRead = STATEMENTS.findIndex((statement) => /visibility/i.test(statement));
    expect(firstRead).toBe(0);
    const visibilityAt = sql.indexOf("ADD COLUMN visibility");
    const firstReadAt = sql.search(/SELECT[^;]*visibility|UPDATE[^;]*visibility|INSERT[^;]*visibility/i);
    expect(visibilityAt).toBeGreaterThan(0);
    expect(visibilityAt).toBeLessThan(firstReadAt);
  });

  it("uses plain ADD COLUMN and plain CREATE INDEX, which TiDB Cloud accepts", () => {
    for (const statement of STATEMENTS) {
      expect(statement).not.toMatch(/IF NOT EXISTS/i);
    }
    expect(sql).toContain("ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'internal';");
    expect(sql).toContain("ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN affiliateToggledAt DATETIME NULL;");
    expect(sql).toContain("ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN affiliateToggledBy INT NULL;");
    expect(sql).toContain("ALTER TABLE cabinet_dealz.affiliate_literature ADD COLUMN affiliateToggledByName VARCHAR(255) NULL;");
    expect(sql).toContain("CREATE INDEX affiliate_literature_visibility_idx ON cabinet_dealz.affiliate_literature");
    // The skipped-error case has to be spelled out, or a re-run looks broken.
    expect(sql).toContain("Duplicate column name");
    expect(sql).toContain("Duplicate key name");
  });

  it("verifies the columns exist before it writes with them", () => {
    const verifyAt = sql.search(/SELECT COUNT\(\*\) AS documentCount/);
    const updateAt = sql.search(/^UPDATE /m);
    const insertAt = sql.search(/^INSERT /m);
    expect(verifyAt).toBeGreaterThan(0);
    expect(verifyAt).toBeLessThan(updateAt);
    expect(verifyAt).toBeLessThan(insertAt);
    expect(sql).toContain("information_schema.columns");
  });

  it("avoids table aliases in UPDATE and in table-reading SELECT", () => {
    const touching = STATEMENTS.filter((statement) => /^(?:UPDATE|SELECT|DELETE)\b/i.test(statement) && /cabinet_dealz\.affiliate_literature/i.test(statement));
    expect(touching.length).toBeGreaterThanOrEqual(3);
    for (const statement of touching) {
      // A table alias looks like a bare word between the table and a keyword.
      expect(statement).not.toMatch(/cabinet_dealz\.affiliate_literature\s+(?:AS\s+)?(?!WHERE\b|ORDER\b|GROUP\b|LIMIT\b|SET\b|\()[a-z_][a-z0-9_]*/i);
    }
    expect(STATEMENTS.some((statement) => /^UPDATE cabinet_dealz\.affiliate_literature SET visibility = 'affiliate' WHERE visibility = 'internal'/.test(statement))).toBe(true);
  });

  it("keeps the guarded insert and the backfill that cannot re-publish", () => {
    expect(sql).toContain("WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_literature WHERE fileKey =");
    expect(sql).toMatch(/^UPDATE cabinet_dealz\.affiliate_literature SET visibility = 'affiliate' WHERE visibility = 'internal' AND isPublished = 1 AND affiliateToggledAt IS NULL;/m);
  });

  it("seeds the Marazzi proposal as internal and unpublished", () => {
    const insert = sql.split("\n").find((line) => line.startsWith("INSERT INTO cabinet_dealz.affiliate_literature"));
    expect(insert).toBeTruthy();
    expect(insert).toContain("'Website Improvement Proposal — Lessons from Marazzi USA'");
    expect(insert).toContain("library-documents/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf");
    expect(insert).toContain("'application/pdf'");
    // isPublished 0 and visibility 'internal': the two values that keep it in.
    expect(insert).toContain(", 0, 'internal', 900 FROM DUAL");
    expect(insert).not.toMatch(/'affiliate'/);
    expect(insert).not.toMatch(/, 1, '/);
  });

  it("picks a number that is still free in the repository", () => {
    expect(existsSync(resolve(root, SQL_FILE))).toBe(true);
    // 0250 is the kitchen rules SQL, 0251-0253 belong to pull request 268, and
    // 0254 is taken; 0255 is the first free number.
    expect(sql).toContain("0250 belongs to the kitchen rules SQL");
    expect(sql).toContain("0251-0253 to pull request");
    expect(existsSync(resolve(root, "docs/sql/0250_library_internal_documents.tidb.sql"))).toBe(false);
  });
});

describe("the committed internal proposal PDF", () => {
  it("ships in the repo and is not served by the site", () => {
    expect(existsSync(resolve(root, PDF_FILE))).toBe(true);
    const bytes = readFileSync(resolve(root, PDF_FILE));
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // The SQL row records the exact byte count, so the file and the row agree.
    expect(sql).toContain(`'application/pdf', ${bytes.length}, 0, 'internal', 900`);
  });

  it("keeps docs/ out of the Vercel build, so the PDF has no public URL", () => {
    const vercelIgnore = read(".vercelignore").split("\n").map((line) => line.trim());
    expect(vercelIgnore).toContain("docs");
  });

  it("is the file the patch's importer uploads, by name and hash", () => {
    const bytes = readFileSync(resolve(root, PDF_FILE));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    expect(patch).toContain("website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf");
    expect(patch).toContain("library-documents/internal/");
    // Recorded in this test so a swapped file is a visible change, not a silent one.
    expect(sha256).toBe("c9cf60ae85cfaec1ce3a5954653888ad5594d50ebdf915375d958e0042391104");
  });

  it("is not referenced by the app shell", () => {
    expect(html).not.toContain("website-improvement-proposal");
    expect(admin).not.toContain("website-improvement-proposal");
  });
});

describe("the admin page contract", () => {
  it("puts an Affiliate library checkbox on every document, internal ones included", () => {
    expect(admin).toContain("AFFILIATE_LIBRARY_SWITCH_LABEL");
    expect(admin).toContain("items.map((item) =>");
    expect(admin).toContain('id={`library-affiliate-${item.id}`}');
    expect(admin).toContain("checked={inAffiliate}");
    // Every row renders the checkbox, with no visibility filter in front of it.
    expect(admin).not.toMatch(/items\.filter\([^)]*\)\.map\(\(item\) =>[\s\S]*library-affiliate/);
  });

  it("sends one field for the toggle and never a publish flag", () => {
    expect(admin).toContain("update.mutate({ id, inAffiliateLibrary: checked })");
    expect(admin).toContain("inAffiliateLibrary,");
    expect(admin).not.toContain("isPublished");
  });

  it("tells the admin the check never makes a document public", () => {
    expect(admin).toContain("This checkbox never puts a document on the public site");
    expect(admin).toContain("Off keeps this document admin-only");
    expect(admin).toContain("Neither one makes it public");
  });
});

describe("the backend patch", () => {
  it("touches only the library, the storage rules, and the shared module", () => {
    const files = [...patch.matchAll(/^diff --git a\/(\S+) b\//gm)].map((match) => match[1]);
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
      // The backend repo carries a mirror of these client files, so the page
      // the server renders is the same one this repo ships.
      expect(file).toMatch(/^(drizzle\/schema\.ts|server\/routers\/affiliateLiterature\.ts|server\/routers\/affiliateResources\.ts|server\/storage\.ts|server\/_core\/storageProxy\.ts|server\/scripts\/import-internal-library-documents\.ts|server\/internalLibraryDocuments\.test\.ts|server\/affiliateLiterature\.test\.ts|shared\/libraryVisibility\.ts|shared\/libraryVisibility\.test\.ts|client\/src\/components\/admin\/AffiliateLiteratureAdmin\.tsx|client\/src\/components\/admin\/AffiliateLiteratureAdmin\.test\.tsx|client\/src\/components\/admin\/AffiliateLiteratureAdmin\.library\.test\.ts|client\/src\/components\/admin\/AdminTabHelp\.tsx|client\/src\/lib\/libraryAdminProcedures\.ts|docs\/sql\/0255_library_internal_documents\.tidb\.sql)$/);
    }
  });

  it("enforces visibility inside the affiliate read, not only in the page", () => {
    expect(patch).toContain('eq(affiliateLiterature.visibility, "affiliate")');
    expect(patch).toContain("eq(affiliateLiterature.isPublished, true)");
    expect(patch).toContain(".filter(isAffiliateLibraryDocument)");
  });

  it("keeps library bytes in the private bucket, off the public proxy", () => {
    expect(patch).toContain('"library-documents/"');
    expect(patch).toContain("not available at a public address");
  });

  it("applies cleanly in the cabinet-backend checkout", () => {
    expect(patch.startsWith("From: Cursor Agent")).toBe(true);
    expect(patch).toContain("git apply");
    // A reviewable preamble with the run order, not a bare format-patch dump.
    const preamble = patch.split("\ndiff --git ")[0];
    expect(preamble).toContain("Paste docs/sql/0255_library_internal_documents.tidb.sql in the TiDB editor");
    expect(preamble).toContain("import-internal-library-documents.ts");
    expect(preamble).not.toMatch(/\bTODO\b|\bFIXME\b/);
    // Every hunk carries a real file header, so a truncated copy is caught here.
    const hunks = patch.match(/^@@ /gm) ?? [];
    expect(hunks.length).toBeGreaterThan(20);
  });
});
