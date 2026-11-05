// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GoogleReviewsResult } from "@shared/googleReviews";

const PLACE_ID = "ChIJj61dQgK6j4AR4GeTYWZsKWw";

const { mutate, mutationOptions, probeState, invalidate } = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutationOptions: {
    current: null as null | {
      onSuccess?: () => void;
      onError?: (error: { message: string }) => void;
    },
  },
  probeState: {
    current: {
      data: undefined as GoogleReviewsResult | undefined,
      isLoading: false,
      error: null as null | { message: string },
    },
  },
  invalidate: vi.fn(async () => undefined),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ affiliates: { invalidate } }),
    affiliates: {
      updateMyStorefront: {
        useMutation: (options: typeof mutationOptions.current) => {
          mutationOptions.current = options;
          return { mutate, isPending: false };
        },
      },
    },
  },
}));

vi.mock("@/lib/googleReviewsProcedures", () => ({
  useGoogleReviewsQuery: () => probeState.current,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { AffiliateGoogleReviewsPanel } = await import("./AffiliateGoogleReviewsPanel");

afterEach(() => {
  cleanup();
  mutate.mockReset();
  invalidate.mockReset();
  mutationOptions.current = null;
  probeState.current = { data: undefined, isLoading: false, error: null };
});

function renderPanel(props: { googlePlaceId?: string | null } = {}) {
  return render(
    <AffiliateGoogleReviewsPanel
      affiliateId={7}
      slug="sample-cabinets"
      googlePlaceId={props.googlePlaceId ?? null}
    />,
  );
}

describe("AffiliateGoogleReviewsPanel", () => {
  it("saves the parsed place ID, not the raw pasted link", () => {
    renderPanel();
    const input = screen.getByLabelText(/Google Place ID or Maps link/i);
    fireEvent.change(input, {
      target: { value: `https://www.google.com/maps/search/?api=1&query=cabinets&query_place_id=${PLACE_ID}` },
    });

    fireEvent.click(screen.getByRole("button", { name: /save google place/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({ googlePlaceId: PLACE_ID });
  });

  it("refuses a link that needs a lookup and explains what to paste instead", () => {
    renderPanel();
    const input = screen.getByLabelText(/Google Place ID or Maps link/i);
    fireEvent.change(input, {
      target: { value: "https://www.google.com/maps/place/Shop/data=!4m2!3m1!1s0x88d9b0a7b4567890:0xa4f25c571acded3f" },
    });

    const saveButton = screen.getByRole("button", { name: /save google place/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    const text = document.body.textContent ?? "";
    expect(text).toContain("does not contain the Place ID");
  });

  it("removes the place from the storefront", () => {
    renderPanel({ googlePlaceId: PLACE_ID });
    fireEvent.click(screen.getByRole("button", { name: /remove from storefront/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    // A cleared setting is saved as an explicit null so the server can unset it.
    expect(mutate.mock.calls[0][0]).toMatchObject({ googlePlaceId: null });
  });

  it("shows the place ID and a link to check the place on Google", () => {
    renderPanel({ googlePlaceId: PLACE_ID });
    const text = document.body.textContent ?? "";
    expect(text).toContain(PLACE_ID);
    expect(
      screen.getByRole("link", { name: /check this place on google maps/i }).getAttribute("href"),
    ).toContain(`query_place_id=${PLACE_ID}`);
  });

  it("says when reviews will render once the server key is present", () => {
    probeState.current = {
      data: {
        status: "ok",
        placeId: PLACE_ID,
        placeName: "Sample Kitchen",
        rating: 4.8,
        userRatingCount: 12,
        reviews: [{ name: "a" }, { name: "b" }],
        links: { place: null, reviews: null, writeReview: null },
        fetchedAt: "2026-11-05T02:00:00Z",
        embedApiKey: "embed-key",
      },
      isLoading: false,
      error: null,
    };
    renderPanel({ googlePlaceId: PLACE_ID });
    expect(document.body.textContent).toContain("2 Google reviews ready to show.");
  });

  it("tells the affiliate the API key is still missing rather than failing silently", () => {
    probeState.current = {
      data: { status: "not-configured", message: "GOOGLE_PLACES_API_KEY is not set on the API server." },
      isLoading: false,
      error: null,
    };
    renderPanel({ googlePlaceId: PLACE_ID });
    const text = document.body.textContent ?? "";
    expect(text).toContain("GOOGLE_PLACES_API_KEY");
    expect(text).toContain("the tab links to Google until then");
  });

  it("documents the no-incentive and no-filtering rules in the panel", () => {
    renderPanel();
    const text = document.body.textContent ?? "";
    expect(text).toContain("Never offer a discount or gift for a review");
    expect(text).toContain("We never filter out low ratings");
    expect(text).toContain("Customer Reviews badge is a Merchant Center add-on");
  });
});
