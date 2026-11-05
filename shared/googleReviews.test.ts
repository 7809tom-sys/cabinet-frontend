import { describe, expect, it } from "vitest";
import {
  GOOGLE_REVIEWS_MAX_RETURNED,
  GOOGLE_PLACES_FIELD_MASK,
  googleMapEmbedUrl,
  googleReadReviewsUrl,
  googleWriteReviewUrl,
  parseGooglePlaceInput,
  readStoredGooglePlaceId,
  toReviewViews,
  type GooglePlacesReview,
} from "./googleReviews";

const PLACE_ID = "ChIJj61dQgK6j4AR4GeTYWZsKWw";

function review(overrides: Partial<GooglePlacesReview> = {}): GooglePlacesReview {
  return {
    name: "places/ChIJj61dQgK6j4AR4GeTYWZsKWw/reviews/AbFvOqn2",
    relativePublishTimeDescription: "2 days ago",
    text: { text: "Great cabinets and a fast quote.", languageCode: "en" },
    originalText: { text: "Great cabinets and a fast quote.", languageCode: "en" },
    rating: 5,
    authorAttribution: {
      displayName: "Dana R.",
      uri: "https://www.google.com/maps/contrib/11885663895765773631",
      photoUri: "https://lh3.googleusercontent.com/a/abc",
    },
    publishTime: "2026-10-30T15:01:23Z",
    flagContentUri: "https://www.google.com/local/review/rap/report?postId=1",
    googleMapsUri: "https://www.google.com/maps/reviews/data=!4m8!1m2!18m1",
    ...overrides,
  };
}

describe("parseGooglePlaceInput", () => {
  it("accepts a bare place ID", () => {
    const result = parseGooglePlaceInput(PLACE_ID);
    expect(result).toEqual({ ok: true, placeId: PLACE_ID, from: "place-id" });
  });

  it("accepts the documented place_id prefix", () => {
    const result = parseGooglePlaceInput(`place_id:${PLACE_ID}`);
    expect(result.ok && result.placeId).toBe(PLACE_ID);
  });

  it("extracts query_place_id from a Google Maps search link", () => {
    const result = parseGooglePlaceInput(
      `https://www.google.com/maps/search/?api=1&query=cabinets&query_place_id=${PLACE_ID}`,
    );
    expect(result).toEqual({ ok: true, placeId: PLACE_ID, from: "maps-link" });
  });

  it("extracts place_id from a Maps URL without a scheme", () => {
    const result = parseGooglePlaceInput(`google.com/maps/place/?q=place_id:${PLACE_ID}`);
    expect(result.ok && result.placeId).toBe(PLACE_ID);
  });

  it("refuses a link that would need an API lookup instead of guessing", () => {
    const result = parseGooglePlaceInput(
      "https://www.google.com/maps/place/Sample+Kitchen/data=!4m2!3m1!1s0x88d9b0a7b4567890:0xa4f25c571acded3f",
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("needs-lookup");
    expect(result.ok === false && result.message).toContain("ChIJ");
  });

  it("refuses a cid link and a shortened link", () => {
    expect(parseGooglePlaceInput("https://maps.google.com/?cid=11885663895765773631")).toMatchObject({ ok: false, code: "needs-lookup" });
    expect(parseGooglePlaceInput("https://g.page/r/abc123/review")).toMatchObject({ ok: false, code: "needs-lookup" });
  });

  it("refuses links that are not Google", () => {
    expect(parseGooglePlaceInput("https://example.com/maps/place/1")).toMatchObject({ ok: false, code: "invalid" });
    expect(parseGooglePlaceInput("not a link at all")).toMatchObject({ ok: false, code: "invalid" });
  });

  it("treats an empty value as empty", () => {
    expect(parseGooglePlaceInput("   ")).toMatchObject({ ok: false, code: "empty" });
    expect(parseGooglePlaceInput(null)).toMatchObject({ ok: false, code: "empty" });
  });
});

describe("readStoredGooglePlaceId", () => {
  it("reads a stored place ID and ignores anything else", () => {
    expect(readStoredGooglePlaceId(PLACE_ID)).toBe(PLACE_ID);
    expect(readStoredGooglePlaceId("https://maps.google.com/?cid=1")).toBeNull();
    expect(readStoredGooglePlaceId(42)).toBeNull();
    expect(readStoredGooglePlaceId(null)).toBeNull();
  });
});

describe("official links", () => {
  it("uses Google's documented write-a-review format", () => {
    expect(googleWriteReviewUrl(PLACE_ID)).toBe(
      `https://search.google.com/local/writereview?placeid=${PLACE_ID}`,
    );
  });

  it("links to reviews with a documented query_place_id Maps URL", () => {
    const url = googleReadReviewsUrl(PLACE_ID, "Sample Kitchen");
    expect(url).toBe(
      `https://www.google.com/maps/search/?api=1&query=Sample%20Kitchen&query_place_id=${PLACE_ID}`,
    );
  });

  it("builds an official Embed API URL only when a key exists", () => {
    expect(googleMapEmbedUrl(PLACE_ID, null)).toBeNull();
    expect(googleMapEmbedUrl(PLACE_ID, "   ")).toBeNull();
    const url = googleMapEmbedUrl(PLACE_ID, "embed-key", { language: "es" });
    expect(url).toContain("https://www.google.com/maps/embed/v1/place?");
    expect(url).toContain(`q=place_id%3A${PLACE_ID}`);
    expect(url).toContain("key=embed-key");
    expect(url).toContain("language=es");
    // Never the undocumented output=embed form.
    expect(url).not.toContain("output=embed");
  });
});

describe("toReviewViews", () => {
  it("keeps every review in Google's order and never filters by rating", () => {
    const views = toReviewViews([
      review({ name: "a", rating: 1, text: { text: "Late delivery.", languageCode: "en" } }),
      review({ name: "b", rating: 5, text: { text: "Excellent.", languageCode: "en" } }),
      review({ name: "c", rating: 3, text: { text: "Fine.", languageCode: "en" } }),
    ]);
    expect(views.map((view) => view.rating)).toEqual([1, 5, 3]);
    expect(views.map((view) => view.text)).toEqual(["Late delivery.", "Excellent.", "Fine."]);
  });

  it("keeps review text exactly as Google returned it", () => {
    const text = "  Good value — asked twice for a sample.\nSecond line.  ";
    const [view] = toReviewViews([review({ text: { text, languageCode: "en" }, originalText: { text, languageCode: "en" } })]);
    expect(view.text).toBe(text);
  });

  it("carries the author attribution Google requires", () => {
    const [view] = toReviewViews([review()]);
    expect(view.authorName).toBe("Dana R.");
    expect(view.authorProfileUrl).toContain("google.com/maps/contrib/");
    expect(view.authorPhotoUrl).toContain("googleusercontent.com");
    expect(view.googleMapsUri).toContain("google.com/maps/reviews");
    expect(view.flagContentUri).toContain("report");
    expect(view.relativeDate).toBe("2 days ago");
  });

  it("marks a translated review and keeps the original alongside", () => {
    const [view] = toReviewViews([
      review({
        text: { text: "Beautiful kitchen.", languageCode: "en" },
        originalText: { text: "Cocina hermosa.", languageCode: "es" },
      }),
    ]);
    expect(view.translated).toBe(true);
    expect(view.text).toBe("Beautiful kitchen.");
    expect(view.originalText).toBe("Cocina hermosa.");
  });

  it("does not mark an untranslated review as translated", () => {
    const [view] = toReviewViews([review()]);
    expect(view.translated).toBe(false);
    expect(view.originalText).toBeNull();
  });

  it("shows the visit month for places that return one", () => {
    const [view] = toReviewViews([review({ visitDate: { year: 2026, month: 3 } })]);
    expect(view.visitDate).toBe("March 2026");
  });

  it("never returns more than Google's five-review maximum", () => {
    const many = Array.from({ length: 9 }, (_, index) => review({ name: `r-${index}` }));
    expect(toReviewViews(many)).toHaveLength(GOOGLE_REVIEWS_MAX_RETURNED);
  });

  it("returns nothing at all for a place with no reviews", () => {
    expect(toReviewViews([])).toEqual([]);
    expect(toReviewViews(null)).toEqual([]);
    expect(toReviewViews(undefined)).toEqual([]);
  });
});

describe("Places API contract", () => {
  it("requests the reviews field plus the fields the display rules need", () => {
    const fields = GOOGLE_PLACES_FIELD_MASK.split(",");
    for (const field of ["id", "displayName", "rating", "userRatingCount", "googleMapsLinks", "reviews"]) {
      expect(fields).toContain(field);
    }
  });
});
