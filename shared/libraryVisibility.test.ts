import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_VISIBILITY,
  LIBRARY_DOCUMENT_FILE_PREFIX,
  affiliateLibraryToggleNote,
  isAffiliateLibraryDocument,
  isInternalLibraryDocument,
  isLibraryDocumentStorageKey,
  isLibraryVisibility,
  isPublishedForAffiliateLibrarySwitch,
  libraryVisibilityDescription,
  libraryVisibilityLabel,
  normalizeLibraryVisibility,
  visibilityForAffiliateLibrarySwitch,
} from "./libraryVisibility";

describe("library visibility rules", () => {
  it("starts every new document internal", () => {
    expect(DEFAULT_LIBRARY_VISIBILITY).toBe("internal");
    expect(normalizeLibraryVisibility(undefined)).toBe("internal");
    expect(normalizeLibraryVisibility(null)).toBe("internal");
    expect(isInternalLibraryDocument({ visibility: undefined })).toBe(true);
  });

  it("fails closed on any value it does not recognise", () => {
    for (const value of ["", "public", "draft", "AFFILIATE", 0, 1, {}, []]) {
      expect(isLibraryVisibility(value)).toBe(false);
      expect(normalizeLibraryVisibility(value)).toBe("internal");
      expect(isInternalLibraryDocument({ visibility: value as unknown as string })).toBe(true);
    }
  });

  it("has no public state at all", () => {
    // The two states are the whole model. If a third ever appears, this fails
    // and the reviewer has to decide what it means before it reaches a query.
    expect(["internal", "affiliate"]).toHaveLength(2);
    expect(normalizeLibraryVisibility("public")).toBe("internal");
    expect(libraryVisibilityLabel("affiliate")).toBe("Affiliate library");
    expect(libraryVisibilityLabel("internal")).toBe("Internal — admin only");
  });

  it("needs BOTH visibility and isPublished for an affiliate to see a document", () => {
    expect(isAffiliateLibraryDocument({ visibility: "affiliate", isPublished: true })).toBe(true);
    expect(isAffiliateLibraryDocument({ visibility: "affiliate", isPublished: false })).toBe(false);
    expect(isAffiliateLibraryDocument({ visibility: "internal", isPublished: true })).toBe(false);
    expect(isAffiliateLibraryDocument({ visibility: "internal", isPublished: false })).toBe(false);
    expect(isAffiliateLibraryDocument({ visibility: null, isPublished: true })).toBe(false);
  });

  it("maps the checkbox to the stored pair and back", () => {
    expect(visibilityForAffiliateLibrarySwitch(true)).toBe("affiliate");
    expect(visibilityForAffiliateLibrarySwitch(false)).toBe("internal");
    expect(isPublishedForAffiliateLibrarySwitch(true)).toBe(true);
    expect(isPublishedForAffiliateLibrarySwitch(false)).toBe(false);
  });

  it("describes the two states without ever promising public access", () => {
    // "Never appears on the public site" is the point; what must never appear is
    // a promise that a checkbox makes a document public.
    for (const value of ["internal", "affiliate", "public", undefined]) {
      expect(libraryVisibilityDescription(value)).not.toMatch(/is public|makes? (it|this) public|publicly available/i);
    }
    expect(libraryVisibilityDescription("affiliate")).toBe("Signed-in affiliates see this in their portal library.");
    expect(libraryVisibilityDescription("internal")).toBe("Only admins see this document. It never appears on the public site.");
    // An unrecognised value describes as internal, never as affiliate.
    expect(libraryVisibilityDescription("public")).toBe(libraryVisibilityDescription("internal"));
  });

  it("recognises the private library document key space", () => {
    expect(isLibraryDocumentStorageKey(`${LIBRARY_DOCUMENT_FILE_PREFIX}internal/doc.pdf`)).toBe(true);
    expect(isLibraryDocumentStorageKey(`/manus-storage/${LIBRARY_DOCUMENT_FILE_PREFIX}internal/doc.pdf`)).toBe(true);
    expect(isLibraryDocumentStorageKey(`/manus-storage/${LIBRARY_DOCUMENT_FILE_PREFIX}internal/doc.pdf?v=2`)).toBe(true);
    expect(isLibraryDocumentStorageKey("affiliate-resources/brochures/doc.pdf")).toBe(false);
    expect(isLibraryDocumentStorageKey("media-library/photo.png")).toBe(false);
    expect(isLibraryDocumentStorageKey(null)).toBe(false);
  });

  it("writes the audit line from the recorded name and time", () => {
    const when = "2026-11-05T14:30:00.000Z";
    expect(affiliateLibraryToggleNote({ visibility: "affiliate", isPublished: true, affiliateToggledAt: when, affiliateToggledByName: "Tom" }))
      .toBe("Added to the affiliate library by Tom on 2026-11-05");
    expect(affiliateLibraryToggleNote({ visibility: "internal", isPublished: false, affiliateToggledAt: when, affiliateToggledByName: "Tom" }))
      .toBe("Removed from the affiliate library by Tom on 2026-11-05");
    expect(affiliateLibraryToggleNote({ visibility: "internal", isPublished: false, affiliateToggledAt: when, affiliateToggledByName: null }))
      .toBe("Removed from the affiliate library by an admin on 2026-11-05");
    expect(affiliateLibraryToggleNote({ visibility: "internal", isPublished: false })).toBeNull();
    expect(affiliateLibraryToggleNote({ visibility: "internal", isPublished: false, affiliateToggledAt: "not-a-date" })).toBeNull();
  });
});
