/**
 * Visibility rules for the Cabinetdealz document library
 * (`cabinet_dealz.affiliate_literature`).
 *
 * Two states, and no third:
 *   internal  — admin only. Never returned to an affiliate and never served
 *               from a public path.
 *   affiliate — the admin checked "Affiliate library". A signed-in affiliate
 *               sees it in the portal's Printed Materials. Still NOT public:
 *               there is no public value, no public query, and the bytes live
 *               in the private storage bucket behind a signed URL.
 *
 * The same file ships in cabinet-backend as `shared/libraryVisibility.ts`, so
 * the server and the admin page cannot disagree about what a value means.
 * New documents start `internal`; only an explicit admin action changes that.
 */

export const LIBRARY_VISIBILITIES = ["internal", "affiliate"] as const;

export type LibraryVisibility = (typeof LIBRARY_VISIBILITIES)[number];

/** New PDFs are internal until an admin adds them to the affiliate library. */
export const DEFAULT_LIBRARY_VISIBILITY: LibraryVisibility = "internal";

/**
 * Storage prefix for library documents. The backend puts this prefix in the
 * private Supabase bucket and refuses it on the public storage proxy, so an
 * internal document has no public URL even if someone guesses the key.
 */
export const LIBRARY_DOCUMENT_FILE_PREFIX = "library-documents/";

/** True for a stored key or `/manus-storage/...` url that holds a library document. */
export function isLibraryDocumentStorageKey(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  const marker = "/manus-storage/";
  const index = trimmed.indexOf(marker);
  const key = index >= 0 ? trimmed.slice(index + marker.length).split("?")[0] : trimmed.replace(/^\/+/, "");
  return key.startsWith(LIBRARY_DOCUMENT_FILE_PREFIX);
}

export const AFFILIATE_LIBRARY_SWITCH_LABEL = "Affiliate library";

export type LibraryVisibilityRow = {
  visibility?: string | null;
  isPublished?: boolean | null;
};

export function isLibraryVisibility(value: unknown): value is LibraryVisibility {
  return typeof value === "string" && (LIBRARY_VISIBILITIES as readonly string[]).includes(value);
}

/**
 * Anything unrecognised - a null column on an old row, a hand-edited value,
 * a value written by a future client - is treated as internal. Failing closed
 * means a typo can hide a document from affiliates but can never widen access.
 */
export function normalizeLibraryVisibility(
  value: unknown,
  fallback: LibraryVisibility = DEFAULT_LIBRARY_VISIBILITY,
): LibraryVisibility {
  return isLibraryVisibility(value) ? value : fallback;
}

export function isInternalLibraryDocument(row: LibraryVisibilityRow): boolean {
  return normalizeLibraryVisibility(row.visibility) === "internal";
}

/**
 * The one predicate the affiliate-facing read must use. Both the visibility
 * column and the legacy isPublished column have to agree, so a raw SQL edit to
 * either one cannot quietly publish an internal strategy document.
 */
export function isAffiliateLibraryDocument(row: LibraryVisibilityRow): boolean {
  return normalizeLibraryVisibility(row.visibility) === "affiliate" && row.isPublished === true;
}

/** The value stored when the "Affiliate library" checkbox is checked or cleared. */
export function visibilityForAffiliateLibrarySwitch(inAffiliateLibrary: boolean): LibraryVisibility {
  return inAffiliateLibrary ? "affiliate" : "internal";
}

/** isPublished is kept in step with the switch so older readers stay correct. */
export function isPublishedForAffiliateLibrarySwitch(inAffiliateLibrary: boolean): boolean {
  return inAffiliateLibrary;
}

export function libraryVisibilityLabel(value: unknown): string {
  return normalizeLibraryVisibility(value) === "affiliate" ? "Affiliate library" : "Internal — admin only";
}

export function libraryVisibilityDescription(value: unknown): string {
  return normalizeLibraryVisibility(value) === "affiliate"
    ? "Signed-in affiliates see this in their portal library."
    : "Only admins see this document. It never appears on the public site.";
}

/** "Added to the affiliate library by Tom on 5 Nov 2026" — or nothing if never toggled. */
export function affiliateLibraryToggleNote(
  row: LibraryVisibilityRow & { affiliateToggledAt?: Date | string | null; affiliateToggledByName?: string | null },
): string | null {
  if (!row.affiliateToggledAt) return null;
  const when = new Date(row.affiliateToggledAt);
  if (Number.isNaN(when.getTime())) return null;
  const actor = (row.affiliateToggledByName ?? "").trim() || "an admin";
  const action = isAffiliateLibraryDocument(row) ? "Added to" : "Removed from";
  return `${action} the affiliate library by ${actor} on ${when.toISOString().slice(0, 10)}`;
}
