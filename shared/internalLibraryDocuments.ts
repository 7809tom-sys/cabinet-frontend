/**
 * Every internal document the library registers by hand, and the file behind it.
 *
 * `cabinet_dealz.affiliate_literature` stores metadata only: a row without the
 * matching object in the private bucket opens a 404. So the committed file, the
 * storage key in the row, and the bytes the importer uploads have to agree, and
 * this manifest is the one place they are written down together.
 *
 *   - the SQL under docs/sql/ writes the row from `internalLibraryRowValues`;
 *   - docs/patches/cabinet-backend-affiliate-app-guide-internal.patch ships this
 *     same file to cabinet-backend, where
 *     `server/scripts/import-internal-library-documents.ts` uploads `file` to
 *     `storageKey` with `mimeType`;
 *   - `shared/internalLibraryDocuments.test.ts` checks the committed bytes
 *     against `sizeBytes` and `sha256`, so a half-copied or re-encoded file is a
 *     test failure rather than a broken download.
 *
 * These files live under `docs/`, which `.vercelignore` excludes, so none of
 * them is served by the site. The keys are under `library-documents/`, which the
 * backend keeps in the private Supabase bucket and refuses on the public storage
 * proxy, so an internal document has no public address even if a key leaks.
 */
import { LIBRARY_DOCUMENT_FILE_PREFIX } from "./libraryVisibility";

export type InternalLibraryDocument = {
  /** Library title, exactly as it appears in the admin library list. */
  title: string;
  /** Admin library description. Internal only: never shown to an affiliate. */
  description: string;
  /** Admin library category. Internal documents use "Internal". */
  category: string;
  /** File name inside `docs/library/internal/`. Also the row's `filename`. */
  file: string;
  /** Private-bucket key, stored in `affiliate_literature.fileKey`. */
  storageKey: string;
  /** Stored in `affiliate_literature.url`. Private: the proxy refuses this path. */
  url: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** Spacing in the admin list. Internal documents sort after the affiliate ones. */
  sortOrder: number;
};

/** Folder in this repository that holds the source file of each document. */
export const INTERNAL_LIBRARY_DIRECTORY = "docs/library/internal";

type DocumentSeed = Omit<InternalLibraryDocument, "storageKey" | "url">;

function internalDocument(seed: DocumentSeed): InternalLibraryDocument {
  const storageKey = `${LIBRARY_DOCUMENT_FILE_PREFIX}internal/${seed.file}`;
  return {
    ...seed,
    storageKey,
    // Mirrors what storagePut returns for a private key, which is what the row stores.
    url: `/manus-storage/${storageKey}`,
  };
}

export const INTERNAL_LIBRARY_DOCUMENTS: readonly InternalLibraryDocument[] = [
  internalDocument({
    title: "Website Improvement Proposal — Lessons from Marazzi USA",
    description:
      "Internal strategy proposal for Tom. Adapts Marazzi USA merchandising patterns (shop-by-look, room-first product pages, sample doors as CRM leads, find-a-dealer) to Cabinetdealz, in three phases. Internal only: never shown on the public site or in an affiliate portal.",
    category: "Internal",
    file: "website-improvement-proposal-marazzi-lessons-cabinetdealz.pdf",
    mimeType: "application/pdf",
    sizeBytes: 92281,
    sha256: "c9cf60ae85cfaec1ce3a5954653888ad5594d50ebdf915375d958e0042391104",
    sortOrder: 900,
  }),
  internalDocument({
    title: "How to Create an App for an Affiliate",
    description:
      "Internal ops guide for Tom. One shared Cabinetdealz codebase for every affiliate, with a separate Google Play listing and a separate Apple App Store listing per affiliate brand (own name, icon, screenshots). The app resolves the affiliate at login from the signed-in account and that affiliate custom domain, not from which store listing was installed. Internal only: never shown on the public site or in an affiliate portal until Tom adds it to the affiliate library.",
    category: "Internal",
    file: "how-to-create-an-app-for-an-affiliate.md",
    mimeType: "text/plain",
    sizeBytes: 8025,
    sha256: "66c0e9043fb15caad4d57283be87692c412ba66c80f2ab33d029617780579336",
    sortOrder: 901,
  }),
];

/** Committed source file of a document, relative to the repository root. */
export function internalLibraryDocumentPath(document: InternalLibraryDocument): string {
  return `${INTERNAL_LIBRARY_DIRECTORY}/${document.file}`;
}

export function internalLibraryDocumentByFile(file: string): InternalLibraryDocument | undefined {
  return INTERNAL_LIBRARY_DOCUMENTS.find((document) => document.file === file);
}

export function internalLibraryDocumentByKey(storageKey: string): InternalLibraryDocument | undefined {
  return INTERNAL_LIBRARY_DOCUMENTS.find((document) => document.storageKey === storageKey);
}

/** A single-quoted MySQL literal, escaped the way the TiDB editor expects. */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The values of the INSERT that registers one document, in the column order
 * every internal library SQL file uses:
 *   title, description, category, filename, fileKey, url, mimeType,
 *   sizeBytes, isPublished, visibility, sortOrder
 *
 * isPublished is 0 and visibility is 'internal' for every row here: that pair is
 * what keeps a document out of the affiliate portal, and only the admin
 * "Affiliate library" checkbox may change it.
 */
export function internalLibraryRowValues(document: InternalLibraryDocument): string {
  return [
    sqlLiteral(document.title),
    sqlLiteral(document.description),
    sqlLiteral(document.category),
    sqlLiteral(document.file),
    sqlLiteral(document.storageKey),
    sqlLiteral(document.url),
    sqlLiteral(document.mimeType),
    String(document.sizeBytes),
    "0",
    sqlLiteral("internal"),
    String(document.sortOrder),
  ].join(", ");
}

/** The INSERT statement that registers one document, guarded on its fileKey. */
export function internalLibraryInsertSql(document: InternalLibraryDocument): string {
  return (
    "INSERT INTO cabinet_dealz.affiliate_literature (title, description, category, filename, fileKey, url, mimeType, sizeBytes, isPublished, visibility, sortOrder) " +
    `SELECT ${internalLibraryRowValues(document)} FROM DUAL WHERE NOT EXISTS ` +
    `(SELECT 1 FROM cabinet_dealz.affiliate_literature WHERE fileKey = ${sqlLiteral(document.storageKey)});`
  );
}
