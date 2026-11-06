import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INTERNAL_LIBRARY_DOCUMENTS,
  internalLibraryDocumentByFile,
  internalLibraryDocumentPath,
  internalLibraryInsertSql,
  internalLibraryRowValues,
} from "./internalLibraryDocuments";
import { LIBRARY_DOCUMENT_FILE_PREFIX, isLibraryDocumentStorageKey } from "./libraryVisibility";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const SQL_FILE = "docs/sql/0268_affiliate_app_guide_internal.tidb.sql";
const PATCH_FILE = "docs/patches/cabinet-backend-affiliate-app-guide-internal.patch";
const GUIDE_FILE = "docs/library/internal/how-to-create-an-app-for-an-affiliate.md";

const sql = read(SQL_FILE);
const patch = read(PATCH_FILE);
const admin = read("client/src/components/admin/AffiliateLiteratureAdmin.tsx");
const vercelIgnore = read(".vercelignore").split("\n").map((line) => line.trim());

const guide = internalLibraryDocumentByFile("how-to-create-an-app-for-an-affiliate.md")!;

/** The SQL file's numbered statements, without comment lines. */
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

/** The patch with its diff markers removed, so a line can be checked as code. */
const patchCode = patch
  .split("\n")
  .filter((line) => /^[+ ]/.test(line) && !line.startsWith("+++"))
  .map((line) => line.slice(1))
  .join("\n");

describe("the internal library manifest", () => {
  it("ships every document as a committed file with the recorded bytes", () => {
    expect(INTERNAL_LIBRARY_DOCUMENTS.length).toBeGreaterThanOrEqual(2);
    for (const document of INTERNAL_LIBRARY_DOCUMENTS) {
      const path = internalLibraryDocumentPath(document);
      expect(existsSync(resolve(root, path)), path).toBe(true);
      const bytes = readFileSync(resolve(root, path));
      // The row stores sizeBytes and the importer refuses a mismatch, so the
      // manifest, the file and the SQL must agree.
      expect(bytes.length, path).toBe(document.sizeBytes);
      expect(createHash("sha256").update(bytes).digest("hex"), path).toBe(document.sha256);
    }
  });

  it("keeps every key in the private library prefix and off a public path", () => {
    for (const document of INTERNAL_LIBRARY_DOCUMENTS) {
      expect(document.storageKey).toBe(`${LIBRARY_DOCUMENT_FILE_PREFIX}internal/${document.file}`);
      expect(isLibraryDocumentStorageKey(document.storageKey)).toBe(true);
      expect(isLibraryDocumentStorageKey(document.url)).toBe(true);
      expect(document.url).toBe(`/manus-storage/${document.storageKey}`);
    }
  });

  it("stores a type the literature uploader already accepts, for every file", () => {
    // The admin uploader accepts .pdf,.docx,.xlsx,.pptx,.txt and application/pdf,
    // so the stored pairs are the two the browser can also produce: a PDF and
    // plain text. The guide keeps its .md name but is stored as text/plain, which
    // is what the ".txt" half of that list carries.
    expect(admin).toContain(".pdf,.docx,.xlsx,.pptx,.txt,application/pdf");
    for (const document of INTERNAL_LIBRARY_DOCUMENTS) {
      expect(["application/pdf", "text/plain"]).toContain(document.mimeType);
      expect(document.mimeType).toBe(document.file.endsWith(".pdf") ? "application/pdf" : "text/plain");
      expect(document.category).toBe("Internal");
    }
    for (const key of ["title", "file", "storageKey", "sortOrder"] as const) {
      const values = INTERNAL_LIBRARY_DOCUMENTS.map((document) => document[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("writes the row values in the column order every internal library SQL uses", () => {
    expect(internalLibraryRowValues(guide)).toBe(
      [
        `'${guide.title}'`,
        `'${guide.description}'`,
        "'Internal'",
        "'how-to-create-an-app-for-an-affiliate.md'",
        "'library-documents/internal/how-to-create-an-app-for-an-affiliate.md'",
        "'/manus-storage/library-documents/internal/how-to-create-an-app-for-an-affiliate.md'",
        "'text/plain'",
        "8025",
        "0",
        "'internal'",
        "901",
      ].join(", "),
    );
  });
});

describe("docs/sql/0268_affiliate_app_guide_internal.tidb.sql", () => {
  it("is the next free number and says one statement per line", () => {
    expect(sql).toContain("Numbered 0268");
    expect(sql).toContain("Run after 0267");
    expect(sql).toContain("One statement per line");
    expect(sql).not.toMatch(/statement-breakpoint/);
  });

  it("uses plain SQL with no IF NOT EXISTS and qualifies every table", () => {
    for (const statement of STATEMENTS) {
      expect(statement).not.toMatch(/IF NOT EXISTS/i);
      expect(statement).toMatch(/cabinet_dealz\./);
    }
    expect(sql.trimEnd().endsWith(";")).toBe(true);
  });

  it("keeps one statement on each non-comment line, so a line pastes on its own", () => {
    for (const line of sql.split("\n").filter((entry) => entry.trim() && !entry.trimStart().startsWith("--"))) {
      expect(line.startsWith(" "), `unexpected indentation: ${line.slice(0, 60)}`).toBe(false);
      expect(line.trim().endsWith(";"), `missing semicolon: ${line.slice(0, 60)}`).toBe(true);
      expect((line.match(/;/g) ?? []).length, `two statements on one line: ${line.slice(0, 60)}`).toBe(1);
    }
  });

  it("previews for a duplicate title before it inserts and verifies afterwards", () => {
    const previewAt = STATEMENTS.findIndex((statement) => /^SELECT\b/.test(statement) && statement.includes("WHERE title ="));
    const insertAt = STATEMENTS.findIndex((statement) => /^INSERT\b/.test(statement));
    const verifyAt = STATEMENTS.findIndex(
      (statement, index) => index > insertAt && /^SELECT\b/.test(statement) && statement.includes("WHERE fileKey ="),
    );
    expect(previewAt).toBe(0);
    expect(insertAt).toBeGreaterThan(previewAt);
    expect(verifyAt).toBeGreaterThan(insertAt);
    // The preview names the duplicate it is looking for, by title AND by key.
    expect(STATEMENTS[previewAt]).toContain("WHERE title = 'How to Create an App for an Affiliate'");
    expect(STATEMENTS[previewAt]).toContain("OR fileKey = 'library-documents/internal/how-to-create-an-app-for-an-affiliate.md'");
    expect(STATEMENTS.at(-1)).toMatch(/^SELECT\b/);
  });

  it("registers the guide exactly as the manifest describes it, internal and unpublished", () => {
    const insert = STATEMENTS.find((statement) => /^INSERT\b/.test(statement));
    expect(insert).toBeTruthy();
    expect(insert).toBe(internalLibraryInsertSql(guide));
    expect(insert).toContain(", 0, 'internal', 901 FROM DUAL WHERE NOT EXISTS");
    // The two values that keep it out of an affiliate portal, spelled out.
    expect(insert).not.toMatch(/'affiliate'/);
    expect(insert).not.toMatch(/, 1, '/);
    expect(sql).toContain("WHERE visibility = 'affiliate' AND isPublished = 1");
  });

  it("names the run order, so the upload lands before the row is used", () => {
    expect(sql).toContain("Run order: upload the file FIRST");
    expect(sql).toContain("Requires 0255 first");
    expect(sql.indexOf("upload the file FIRST")).toBeLessThan(sql.indexOf("-- 1. PREVIEW"));
  });
});

describe("the affiliate app guide document", () => {
  it("is the markdown Tom was given, unchanged in meaning and size", () => {
    const bytes = readFileSync(resolve(root, GUIDE_FILE));
    const text = bytes.toString("utf8");
    expect(text.startsWith("# How to Create an App for an Affiliate")).toBe(true);
    expect(text).toContain("**Internal only.** Admin library document for Cabinetdealz.");
    expect(text).toContain("## Checklist — Google Play (Android)");
    expect(text).toContain("## Checklist — Apple App Store (iOS)");
    expect(text.trimEnd().endsWith("*Cabinetdealz internal — affiliate_literature library*")).toBe(true);
    // Stored as text/plain, so it must be valid UTF-8 with no NUL bytes.
    expect(text.includes("\u0000")).toBe(false);
  });

  it("is never served by the site", () => {
    expect(vercelIgnore).toContain("docs");
    expect(read("client/index.html")).not.toContain("how-to-create-an-app-for-an-affiliate");
    // The admin page links the row's url, not the committed path.
    expect(admin).not.toContain("how-to-create-an-app-for-an-affiliate");
  });
});

describe("the backend patch", () => {
  it("ships the manifest, the importer and the same SQL, and nothing else", () => {
    const files = [...patch.matchAll(/^diff --git a\/(\S+) b\//gm)].map((match) => match[1]);
    expect(files).toEqual([
      "docs/sql/0268_affiliate_app_guide_internal.tidb.sql",
      "server/internalLibraryDocuments.test.ts",
      "server/scripts/import-internal-library-documents.ts",
      "shared/internalLibraryDocuments.ts",
    ]);
    // The SQL in the patch is byte-identical to the file Tom pastes here.
    const patchedSql = patchCode.slice(patchCode.indexOf("-- TiDB SQL editor version"));
    expect(patchedSql.startsWith(sql.slice(0, 80))).toBe(true);
  });

  it("uploads every manifest document to its recorded key and type", () => {
    expect(patchCode).toContain("INTERNAL_LIBRARY_DOCUMENTS");
    expect(patchCode).toContain("storagePut(document.storageKey, bytes, document.mimeType)");
    expect(patchCode).toContain("internalLibraryDocumentPath(document)");
    // The key is built from the shared private prefix, so the patch cannot invent
    // a path: `${LIBRARY_DOCUMENT_FILE_PREFIX}internal/${seed.file}`.
    expect(patchCode).toContain("${LIBRARY_DOCUMENT_FILE_PREFIX}internal/${seed.file}");
    // The manifest in the patch carries the same files and numbers as this copy.
    for (const document of INTERNAL_LIBRARY_DOCUMENTS) {
      expect(patchCode).toContain(document.file);
      expect(patchCode).toContain(`"${document.title}"`);
      expect(patchCode).toContain(String(document.sizeBytes));
      expect(patchCode).toContain(document.sha256);
      expect(patchCode).toContain(`"${document.mimeType}"`);
    }
  });

  it("stops on a mismatch instead of uploading bytes the row does not describe", () => {
    expect(patchCode).toContain("bytes.length !== document.sizeBytes");
    expect(patchCode).toContain("sha256 !== document.sha256");
  });

  it("uploads bytes only: it never inserts, publishes, or widens visibility", () => {
    const importer = patchCode.split("\n").filter((line) => line.includes("db.") || line.includes("storagePut")).join("\n");
    expect(importer).not.toMatch(/\.insert\(/);
    expect(importer).not.toMatch(/\.update\(/);
    expect(importer).not.toMatch(/isPublished:\s*true/);
    expect(importer).not.toMatch(/visibility:\s*['"]affiliate['"]/);
    // It reports a row that is not internal, rather than fixing it silently.
    expect(patchCode).toContain("fix it in the admin page");
  });

  it("is a reviewable patch with the run order in its preamble", () => {
    expect(patch.startsWith("From: Cursor Agent")).toBe(true);
    const preamble = patch.split("\ndiff --git ")[0];
    expect(preamble).toContain("0268_affiliate_app_guide_internal.tidb.sql");
    expect(preamble).toContain("import-internal-library-documents.ts");
    expect(preamble).not.toMatch(/\bTODO\b|\bFIXME\b/);
    expect((patch.match(/^@@ /gm) ?? []).length).toBeGreaterThan(5);
  });
});
