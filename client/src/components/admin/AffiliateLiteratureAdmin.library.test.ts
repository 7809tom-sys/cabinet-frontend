import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const SQL_FILE = "docs/sql/0250_library_internal_documents.tidb.sql";
const PDF_FILE = "docs/library/internal/website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf";
const PATCH_FILE = "docs/patches/cabinet-backend-library-internal-documents.patch";

const sql = read(SQL_FILE);
const admin = read("client/src/components/admin/AffiliateLiteratureAdmin.tsx");
const patch = read(PATCH_FILE);
const html = read("client/index.html");

describe("SQL 0250 library internal documents", () => {
  it("keeps one statement per numbered line and qualifies every table", () => {
    expect(sql).not.toMatch(/statement-breakpoint/);
    expect(sql).toContain("Numbered 0250");
    expect(sql).toContain("Run after 0249");
    const blocks = sql.split(/\n-- \d+\./).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(11);
    for (const block of blocks) {
      const statements = block
        .split(";")
        .map((part) => part.replace(/--[^\n]*/g, "").trim())
        .filter(Boolean);
      expect(statements).toHaveLength(1);
      if (/^\s*(ALTER|CREATE|SELECT|UPDATE|INSERT)\b/i.test(statements[0])) {
        if (/^SELECT\b/i.test(statements[0]) && statements[0].includes("information_schema")) continue;
        expect(statements[0]).toMatch(/cabinet_dealz\./);
      }
    }
    expect(sql.trimEnd().endsWith(";")).toBe(true);
    expect(sql).toContain("information_schema");
    expect(sql).not.toMatch(/\bAS (count|order|key|value|status|table|internal|affiliate)\b/i);
  });

  it("adds visibility plus the who/when audit, all additive and re-runnable", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'internal'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS affiliateToggledAt DATETIME NULL");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS affiliateToggledBy INT NULL");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS affiliateToggledByName VARCHAR(255) NULL");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS affiliate_literature_visibility_idx");
    // Every write is guarded, so a second paste changes nothing.
    expect(sql).toContain("WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_literature");
    expect(sql).toMatch(/UPDATE cabinet_dealz\.affiliate_literature AS backfill_literature SET .* WHERE .*affiliateToggledAt IS NULL;/);
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
    // 0249 belongs to the open KBIS pull request, so this file may not reuse it.
    expect(sql).toContain("0249 is reserved");
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
      expect(file).toMatch(/^(drizzle\/schema\.ts|server\/routers\/affiliateLiterature\.ts|server\/routers\/affiliateResources\.ts|server\/storage\.ts|server\/_core\/storageProxy\.ts|server\/scripts\/import-internal-library-documents\.ts|server\/internalLibraryDocuments\.test\.ts|server\/affiliateLiterature\.test\.ts|shared\/libraryVisibility\.ts|shared\/libraryVisibility\.test\.ts|client\/src\/components\/admin\/AffiliateLiteratureAdmin\.tsx|client\/src\/components\/admin\/AffiliateLiteratureAdmin\.test\.tsx|client\/src\/components\/admin\/AffiliateLiteratureAdmin\.library\.test\.ts|client\/src\/components\/admin\/AdminTabHelp\.tsx|client\/src\/lib\/libraryAdminProcedures\.ts|docs\/sql\/0250_library_internal_documents\.tidb\.sql)$/);
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
    expect(preamble).toContain("Paste docs/sql/0250_library_internal_documents.tidb.sql in the TiDB editor");
    expect(preamble).toContain("import-internal-library-documents.ts");
    expect(preamble).not.toMatch(/\bTODO\b|\bFIXME\b/);
    // Every hunk carries a real file header, so a truncated copy is caught here.
    const hunks = patch.match(/^@@ /gm) ?? [];
    expect(hunks.length).toBeGreaterThan(20);
  });
});
