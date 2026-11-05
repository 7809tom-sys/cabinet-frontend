// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { GoogleReviewsResult } from "@shared/googleReviews";
import { StorefrontGoogleReviews } from "./StorefrontGoogleReviews";
import { makeStorefrontT } from "@/lib/storefrontI18n";

const PLACE_ID = "ChIJj61dQgK6j4AR4GeTYWZsKWw";

const { queryState } = vi.hoisted(() => ({
  queryState: {
    current: {
      data: undefined as GoogleReviewsResult | undefined,
      isLoading: false,
      error: null as null | { message: string },
    },
  },
}));

vi.mock("@/lib/googleReviewsProcedures", () => ({
  useGoogleReviewsQuery: () => queryState.current,
}));

const brand = { primary: "#1a2b4a", accent: "#c9a227" };
const t = makeStorefrontT("en");

type OkResult = Extract<GoogleReviewsResult, { status: "ok" }>;

function okResult(overrides: Partial<OkResult> = {}): GoogleReviewsResult {
  return {
    status: "ok",
    placeId: PLACE_ID,
    placeName: "Sample Kitchen & Bath",
    rating: 4.6,
    userRatingCount: 128,
    reviews: [
      {
        name: "places/x/reviews/1",
        relativePublishTimeDescription: "3 days ago",
        text: { text: "Fantastic cabinets, delivered on time.", languageCode: "en" },
        originalText: { text: "Fantastic cabinets, delivered on time.", languageCode: "en" },
        rating: 5,
        authorAttribution: {
          displayName: "Dana R.",
          uri: "https://www.google.com/maps/contrib/1",
          photoUri: "https://lh3.googleusercontent.com/a/dana",
        },
        publishTime: "2026-10-30T15:01:23Z",
        flagContentUri: "https://www.google.com/local/review/rap/report?postId=1",
        googleMapsUri: "https://www.google.com/maps/reviews/data=!4m8!1m2!1",
      },
      {
        name: "places/x/reviews/2",
        relativePublishTimeDescription: "a month ago",
        text: { text: "Two cabinets arrived damaged and the fix took weeks.", languageCode: "en" },
        originalText: { text: "Two cabinets arrived damaged and the fix took weeks.", languageCode: "en" },
        rating: 2,
        authorAttribution: { displayName: "M. Ortiz", uri: "https://www.google.com/maps/contrib/2" },
        publishTime: "2026-10-02T15:01:23Z",
        flagContentUri: "https://www.google.com/local/review/rap/report?postId=2",
        googleMapsUri: "https://www.google.com/maps/reviews/data=!4m8!1m2!2",
      },
    ],
    links: {
      place: "https://maps.google.com/?cid=1",
      reviews: "https://www.google.com/maps/place//data=!4m4!3m3!1s0x1:0x2!9m1!1b1",
      writeReview: `https://search.google.com/local/writereview?placeid=${PLACE_ID}`,
    },
    fetchedAt: "2026-11-05T02:00:00Z",
    embedApiKey: "embed-key",
    ...overrides,
  };
}

function renderSection(props: { placeId?: string } = {}) {
  return render(
    <StorefrontGoogleReviews
      placeId={props.placeId ?? PLACE_ID}
      storeName="Sample"
      brand={brand}
      t={t}
      lang="en"
    />,
  );
}

afterEach(() => {
  cleanup();
  queryState.current = { data: undefined, isLoading: false, error: null };
});

describe("StorefrontGoogleReviews", () => {
  it("renders nothing at all when the store has no place ID", () => {
    const { container } = renderSection({ placeId: "" });
    expect(container.innerHTML).toBe("");
  });

  it("renders Google's official Maps Embed iframe and both outbound links", () => {
    queryState.current = { data: okResult(), isLoading: false, error: null };
    renderSection();

    const frame = screen.getByTestId("google-maps-embed") as HTMLIFrameElement;
    expect(frame.src).toContain("google.com/maps/embed/v1/place");
    expect(frame.src).toContain(`q=place_id%3A${PLACE_ID}`);
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(frame.getAttribute("loading")).toBe("lazy");

    const seeAll = screen.getByRole("link", { name: /see all reviews on google/i });
    expect(seeAll.getAttribute("href")).toBe(
      "https://www.google.com/maps/place//data=!4m4!3m3!1s0x1:0x2!9m1!1b1",
    );

    const write = screen.getByRole("link", { name: /write a review/i });
    expect(write.getAttribute("href")).toContain("search.google.com/local/writereview?placeid=");
  });

  it("shows every review Google returned, including a low rating, in Google's order", () => {
    queryState.current = { data: okResult(), isLoading: false, error: null };
    renderSection();

    const cards = screen.getAllByTestId("google-review");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Fantastic cabinets, delivered on time.");
    // The 2-star review must be present and in the position Google gave it.
    expect(cards[1].textContent).toContain("Two cabinets arrived damaged and the fix took weeks.");
  });

  it("keeps every required author attribution", () => {
    queryState.current = { data: okResult(), isLoading: false, error: null };
    const { container } = renderSection();

    const authorLink = screen.getByRole("link", { name: "Dana R." });
    expect(authorLink.getAttribute("href")).toBe("https://www.google.com/maps/contrib/1");
    expect(authorLink.getAttribute("rel")).toContain("noopener");

    const avatar = container.querySelector('img[src="https://lh3.googleusercontent.com/a/dana"]');
    expect(avatar).not.toBeNull();

    expect(screen.getAllByRole("link", { name: /review on google maps/i })[0].getAttribute("href")).toBe(
      "https://www.google.com/maps/reviews/data=!4m8!1m2!1",
    );
    expect(screen.getAllByRole("link", { name: /report this review/i })[0].getAttribute("href")).toBe(
      "https://www.google.com/local/review/rap/report?postId=1",
    );
  });

  it("shows the Google Maps attribution next to the content, unmodified", () => {
    queryState.current = { data: okResult(), isLoading: false, error: null };
    renderSection();

    const attributions = screen.getAllByTestId("google-maps-attribution");
    expect(attributions.length).toBeGreaterThan(0);
    for (const attribution of attributions) {
      expect(attribution.textContent).toContain("Google Maps");
      // Google requires translate="no" on the text attribution.
      expect(attribution.getAttribute("translate")).toBe("no");
    }
  });

  it("states how the list is ordered and that nothing was filtered", () => {
    queryState.current = { data: okResult(), isLoading: false, error: null };
    renderSection();

    const text = document.body.textContent ?? "";
    expect(text).toContain("Shown in the order Google returned them");
    expect(text).toContain(`We do not filter, edit, or reorder these reviews.`);
    expect(text).toContain("Reviews aren't verified by Google");
  });

  it("shows the average rating only when Google returned one", () => {
    queryState.current = {
      data: okResult({ rating: null, userRatingCount: null }),
      isLoading: false,
      error: null,
    };
    renderSection();
    expect(screen.queryByText(/out of 5/)).toBeNull();
  });

  it("never fills an empty result with sample reviews", () => {
    queryState.current = { data: okResult({ reviews: [] }), isLoading: false, error: null };
    renderSection();

    expect(screen.queryAllByTestId("google-review")).toHaveLength(0);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Google has no reviews to show for this business yet");
  });

  it("falls back to a link card when the API server has no embed key", () => {
    queryState.current = { data: okResult({ embedApiKey: null }), isLoading: false, error: null };
    renderSection();

    expect(screen.queryByTestId("google-maps-embed")).toBeNull();
    expect(screen.getByRole("link", { name: /Sample Kitchen & Bath/ })).not.toBeNull();
    // Never an undocumented embed URL.
    expect(document.body.innerHTML).not.toContain("output=embed");
  });

  it("explains a failed load and still links to Google", () => {
    queryState.current = {
      data: {
        status: "unavailable",
        code: "upstream-error",
        message: "Google reviews couldn't be loaded just now. Try again in a moment.",
      },
      isLoading: false,
      error: null,
    };
    renderSection();

    expect(screen.queryAllByTestId("google-review")).toHaveLength(0);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Google reviews couldn't be loaded just now");
    expect(screen.getByRole("link", { name: /see all reviews on google/i })).not.toBeNull();
  });

  it("uses the place ID for the Google links even before the API answers", () => {
    renderSection();
    expect(screen.getByRole("link", { name: /write a review/i }).getAttribute("href")).toBe(
      `https://search.google.com/local/writereview?placeid=${PLACE_ID}`,
    );
    expect(
      screen.getByRole("link", { name: /see all reviews on google/i }).getAttribute("href"),
    ).toContain(`query_place_id=${PLACE_ID}`);
  });

  it("renders the translated-review notice with the original available", () => {
    queryState.current = {
      data: okResult({
        reviews: [
          {
            name: "places/x/reviews/t",
            relativePublishTimeDescription: "a week ago",
            text: { text: "Beautiful kitchen.", languageCode: "en" },
            originalText: { text: "Cocina hermosa.", languageCode: "es" },
            rating: 5,
            authorAttribution: { displayName: "Ana P." },
            googleMapsUri: "https://www.google.com/maps/reviews/data=!4m8!1m2!9",
          },
        ],
      }),
      isLoading: false,
      error: null,
    };
    renderSection();

    const text = document.body.textContent ?? "";
    expect(text).toContain("Translated by Google");
    expect(text).toContain("Beautiful kitchen.");
    expect(screen.getByRole("button", { name: /read the original/i })).not.toBeNull();
  });
});
