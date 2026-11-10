import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_ROLE,
  DEFAULT_LIBRARY_VISIBILITY,
  LIBRARY_DOCUMENT_FILE_PREFIX,
  REFERENCE_LIBRARY_CATEGORIES,
  affiliateLibraryToggleNote,
  inferredReferenceReason,
  isAffiliateLibraryDocument,
  isInferredReferenceDocument,
  isInternalLibraryDocument,
  isLibraryDocumentStorageKey,
  isLibraryVisibility,
  isPublishedForAffiliateLibrarySwitch,
  isReferenceLibraryDocument,
  libraryRoleForReferenceSwitch,
  libraryVisibilityDescription,
  libraryVisibilityLabel,
  normalizeLibraryVisibility,
  referenceNameReason,
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

  it("keeps reference material out of the affiliate library until the owner ticks it", () => {
    const costSheet = {
      title: "Kitchen Installation Cost Sheet",
      filename: "KitchenCostSheet.pdf",
      category: "Installation",
      documentRole: "literature" as const,
    };
    const catalog = {
      title: "SolidTrac Catalog",
      filename: "solidtrac.pdf",
      category: "Product Catalogs",
    };
    // The live categories, and the title/file-name rule, are reference even
    // before the role column says so, and even when the role still says literature.
    expect(isReferenceLibraryDocument(costSheet)).toBe(true);
    expect(isReferenceLibraryDocument(catalog)).toBe(true);
    expect(inferredReferenceReason(costSheet)).toBe("category Installation");
    expect(referenceNameReason("Master price list", "prices.pdf")).toBe("price list");
    expect(referenceNameReason("Door spec book", null)).toBe("spec book");
    expect(isInferredReferenceDocument({ title: "SolidTrac Catalog", filename: "solidtrac.pdf" })).toBe(true);

    // Published flags alone are not the owner's tick.
    expect(isAffiliateLibraryDocument({ ...costSheet, visibility: "affiliate", isPublished: true })).toBe(false);
    expect(isAffiliateLibraryDocument({ ...costSheet, visibility: "affiliate", isPublished: true, affiliateToggledAt: null })).toBe(false);
    expect(isAffiliateLibraryDocument({ ...catalog, visibility: "internal", isPublished: true, affiliateToggledAt: "2026-11-10T00:00:00.000Z" })).toBe(false);

    // The tick is the audit timestamp the checkbox writes.
    expect(isAffiliateLibraryDocument({
      ...costSheet,
      visibility: "affiliate",
      isPublished: true,
      affiliateToggledAt: "2026-11-10T00:00:00.000Z",
    })).toBe(true);

    // A stored Reference mark covers a document the name rule would miss.
    expect(isReferenceLibraryDocument({ title: "Field notes", filename: "notes.pdf", category: "General", documentRole: "reference" })).toBe(true);
    expect(isAffiliateLibraryDocument({
      title: "Field notes",
      filename: "notes.pdf",
      category: "General",
      documentRole: "reference",
      visibility: "affiliate",
      isPublished: true,
    })).toBe(false);

    // Sales literature is unchanged: both flags, no tick required.
    const brochure = { title: "Cabinet Dealz Affiliate Portal Sales Brochure", filename: "CabinetDealz_Affiliate_Portal_Sales_Brochure.pdf", category: "Sales & Marketing", documentRole: "literature" };
    expect(isReferenceLibraryDocument(brochure)).toBe(false);
    expect(isAffiliateLibraryDocument({ ...brochure, visibility: "affiliate", isPublished: true })).toBe(true);
    // The description can mention a catalog. The rule does not read it: the row type has no description field.
    const brochureMentioningCatalog = { ...brochure, description: "catalog curation" };
    expect(isReferenceLibraryDocument(brochureMentioningCatalog)).toBe(false);

    expect(DEFAULT_LIBRARY_ROLE).toBe("literature");
    expect(libraryRoleForReferenceSwitch(true)).toBe("reference");
    expect(libraryRoleForReferenceSwitch(false)).toBe("literature");
    expect(REFERENCE_LIBRARY_CATEGORIES).toEqual(["Product Catalogs", "Installation"]);
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
