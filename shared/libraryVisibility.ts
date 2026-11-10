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
 * Reference is not a third visibility. A reference document (a catalog, a cost
 * sheet, a price list, a spec book) stays in this same library, in its own
 * section, and is still either internal or affiliate. It is never public.
 * Reference items are not returned to affiliates unless the owner has ticked
 * Affiliate library on that item, which is the only write of the audit columns.
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

export const REFERENCE_LIBRARY_SWITCH_LABEL = "Reference";

/**
 * Roles are separate from visibility. `literature` is the affiliate-literature
 * list. `reference` is the reference section. Anything unrecognised is literature,
 * so a typo cannot hide a document the owner already published by calling it
 * reference, and it cannot by itself publish one either.
 */
export const LIBRARY_ROLES = ["literature", "reference"] as const;

export type LibraryRole = (typeof LIBRARY_ROLES)[number];

export const DEFAULT_LIBRARY_ROLE: LibraryRole = "literature";

/**
 * Categories on the live admin list that are reference material.
 * Sales & Marketing and Training are affiliate literature and are not in this list.
 */
export const REFERENCE_LIBRARY_CATEGORIES = ["Product Catalogs", "Installation"] as const;

/**
 * Title or file-name rule for the other reference documents (price lists, spec
 * books, catalogs and cost sheets filed under some other category). Description
 * text is ignored: a sales brochure can mention a catalog without being one.
 * The same words are in docs/sql/0273 so the one-time UPDATE matches this helper.
 */
export const REFERENCE_NAME_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: "cost sheet", pattern: /cost\s*sheets?/i },
  { label: "price list", pattern: /price\s*lists?/i },
  { label: "spec book", pattern: /spec\s*books?/i },
  { label: "catalog", pattern: /catalogs?/i },
];

/** Categories the upload form offers, including the ones already stored on live rows. */
export const LIBRARY_CATEGORIES = [
  "Internal",
  "Sales",
  "Marketing",
  "Sales & Marketing",
  "Pricing",
  "Training",
  "Legal",
  "Product Catalogs",
  "Installation",
  "General",
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

export type LibraryVisibilityRow = {
  visibility?: string | null;
  isPublished?: boolean | null;
  /** Null when the column has not been added yet. */
  documentRole?: string | null;
  category?: string | null;
  title?: string | null;
  filename?: string | null;
  affiliateToggledAt?: Date | string | null;
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

export function isLibraryRole(value: unknown): value is LibraryRole {
  return typeof value === "string" && (LIBRARY_ROLES as readonly string[]).includes(value);
}

/** A missing or unrecognised role is literature. Reference has to be explicit or inferred. */
export function normalizeLibraryRole(value: unknown): LibraryRole | null {
  if (value == null || value === "") return null;
  return isLibraryRole(value) ? value : null;
}

export function isReferenceLibraryCategory(category: string | null | undefined): boolean {
  const name = (category ?? "").trim();
  return (REFERENCE_LIBRARY_CATEGORIES as readonly string[]).includes(name);
}

/** Why a title or file name is reference material, or null when it is not. */
export function referenceNameReason(title: string | null | undefined, filename: string | null | undefined): string | null {
  const haystack = `${title ?? ""}\n${filename ?? ""}`;
  const match = REFERENCE_NAME_PATTERNS.find((rule) => rule.pattern.test(haystack));
  return match ? match.label : null;
}

/**
 * Reference by category or by title/file name, whether or not the role column
 * has been stored. A stored role of `literature` does not override this: those
 * words are what the owner asked to keep out of the affiliate library.
 */
export function inferredReferenceReason(row: LibraryVisibilityRow): string | null {
  if (isReferenceLibraryCategory(row.category)) return `category ${row.category}`;
  const named = referenceNameReason(row.title, row.filename);
  return named ? `title or file name is a ${named}` : null;
}

export function isInferredReferenceDocument(row: LibraryVisibilityRow): boolean {
  return inferredReferenceReason(row) != null;
}

/**
 * Reference when the owner marked it, or when the category / title / file name
 * rule matches. A null role (column not added yet) still follows the rule.
 */
export function isReferenceLibraryDocument(row: LibraryVisibilityRow): boolean {
  if (normalizeLibraryRole(row.documentRole) === "reference") return true;
  return isInferredReferenceDocument(row);
}

export function libraryRoleForReferenceSwitch(reference: boolean): LibraryRole {
  return reference ? "reference" : "literature";
}

/**
 * The one predicate the affiliate-facing read must use. Both the visibility
 * column and the legacy isPublished column have to agree, so a raw SQL edit to
 * either one cannot quietly publish an internal strategy document.
 *
 * A reference document also needs the audit timestamp. That timestamp is written
 * only when the owner ticks Affiliate library. A row that is merely isPublished,
 * or that was backfilled to visibility affiliate without a tick, stays out.
 */
export function isAffiliateLibraryDocument(row: LibraryVisibilityRow): boolean {
  const published = normalizeLibraryVisibility(row.visibility) === "affiliate" && row.isPublished === true;
  if (!published) return false;
  if (!isReferenceLibraryDocument(row)) return true;
  return hasAffiliateLibraryToggle(row);
}

function hasAffiliateLibraryToggle(row: LibraryVisibilityRow): boolean {
  if (row.affiliateToggledAt == null || row.affiliateToggledAt === "") return false;
  const when = new Date(row.affiliateToggledAt);
  return !Number.isNaN(when.getTime());
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
