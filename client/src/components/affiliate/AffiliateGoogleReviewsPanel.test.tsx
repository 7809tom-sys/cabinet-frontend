// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GooglePlaceCredentialsStatus, GoogleReviewsResult } from "@shared/googleReviews";
import { AffiliateGoogleReviewsPanel } from "./AffiliateGoogleReviewsPanel";

const PLACE_ID = "ChIJj61dQgK6j4AR4GeTYWZsKWw";
// A shape-valid Google key (39 chars, AIza prefix). Not a real credential.
const PLACES_KEY = `AIza${"A".repeat(35)}`;
const EMBED_KEY = `AIza${"B".repeat(35)}`;

const {
  mutate,
  mutationOptions,
  statusState,
  probeState,
  credentialsAvailable,
  refetch,
} = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutationOptions: {
    current: null as null | {
      onSuccess?: (result: GooglePlaceCredentialsStatus) => void;
      onError?: (error: { message: string }) => void;
    },
  },
  statusState: {
    current: {
      data: undefined as GooglePlaceCredentialsStatus | undefined,
      isLoading: false,
      error: null as null | { message: string },
    },
  },
  probeState: {
    current: {
      data: undefined as GoogleReviewsResult | undefined,
      isLoading: false,
      error: null as null | { message: string },
    },
  },
  credentialsAvailable: { current: true },
  refetch: vi.fn(async () => undefined),
}));

vi.mock("@/lib/trpc", () => ({ trpc: {} }));

vi.mock("@/lib/googleReviewsProcedures", () => ({
  useGoogleReviewsQuery: () => probeState.current,
}));

vi.mock("@/lib/googleReviewsCredentials", () => ({
  googleCredentialsProceduresAvailable: () => credentialsAvailable.current,
  googleCredentialsPayload: (args: Record<string, unknown>) => {
    const payload: Record<string, unknown> = { placeId: args.placeId };
    if (args.affiliateId) payload.affiliateId = args.affiliateId;
    const placesKey = String(args.placesApiKey ?? "").trim();
    if (placesKey) payload.placesApiKey = placesKey;
    const embedKey = String(args.mapsEmbedApiKey ?? "").trim();
    if (embedKey) payload.mapsEmbedApiKey = embedKey;
    if (args.clearPlacesApiKey) {
      payload.clearPlacesApiKey = true;
      delete payload.placesApiKey;
    }
    if (args.clearMapsEmbedApiKey) {
      payload.clearMapsEmbedApiKey = true;
      delete payload.mapsEmbedApiKey;
    }
    return payload;
  },
  useGoogleCredentialsQuery: () => ({ ...statusState.current, refetch }),
  useSaveGoogleCredentialsMutation: (options: typeof mutationOptions.current) => {
    if (!credentialsAvailable.current) return null;
    mutationOptions.current = options;
    return { mutate, isPending: false };
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  mutate.mockReset();
  refetch.mockReset();
  mutationOptions.current = null;
  credentialsAvailable.current = true;
  statusState.current = { data: undefined, isLoading: false, error: null };
  probeState.current = { data: undefined, isLoading: false, error: null };
  // Nothing may survive in browser storage.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

function renderPanel(props: {
  googlePlaceId?: string | null;
  hasPlacesApiKey?: boolean;
  hasMapsEmbedApiKey?: boolean;
} = {}) {
  return render(
    <AffiliateGoogleReviewsPanel
      affiliateId={7}
      slug="sample-cabinets"
      googlePlaceId={props.googlePlaceId ?? null}
      credentialHints={{
        hasPlacesApiKey: props.hasPlacesApiKey ?? false,
        hasMapsEmbedApiKey: props.hasMapsEmbedApiKey ?? false,
      }}
    />,
  );
}

describe("AffiliateGoogleReviewsPanel — connecting the affiliate's own Google account", () => {
  it("offers inputs for the place ID and both of the affiliate's own keys", () => {
    renderPanel();
    expect(screen.getByLabelText(/Your Google Place ID or Maps link/i)).toBeTruthy();
    expect(screen.getByLabelText(/Places API key/i)).toBeTruthy();
    expect(screen.getByLabelText(/Maps Embed key/i)).toBeTruthy();
  });

  it("masks both key inputs", () => {
    renderPanel();
    for (const label of [/Places API key/i, /Maps Embed key/i]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.type).toBe("password");
      // Never let the browser or a password manager retain it.
      expect(input.getAttribute("autocomplete")).toBe("off");
      expect(input.getAttribute("data-lpignore")).toBe("true");
    }
  });

  it("says the keys belong to the affiliate and are never shown back", () => {
    renderPanel();
    const text = document.body.textContent ?? "";
    expect(text).toContain("your own Google account");
    expect(text).toContain("Write-only: once saved, a key is never shown again");
    expect(text).toContain("Do not paste anyone else's key");
  });

  it("saves the typed keys with the parsed place ID", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Your Google Place ID or Maps link/i), {
      target: { value: `https://www.google.com/maps/search/?api=1&query=x&query_place_id=${PLACE_ID}` },
    });
    fireEvent.change(screen.getByLabelText(/Places API key/i), { target: { value: PLACES_KEY } });
    fireEvent.change(screen.getByLabelText(/Maps Embed key/i), { target: { value: EMBED_KEY } });

    fireEvent.click(screen.getByTestId("google-reviews-save"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({
      placeId: PLACE_ID,
      placesApiKey: PLACES_KEY,
      mapsEmbedApiKey: EMBED_KEY,
    });
  });

  it("clears the typed key from the form once the server accepts it", () => {
    renderPanel();
    const placesInput = screen.getByLabelText(/Places API key/i) as HTMLInputElement;
    fireEvent.change(placesInput, { target: { value: PLACES_KEY } });
    expect(placesInput.value).toBe(PLACES_KEY);

    fireEvent.click(screen.getByTestId("google-reviews-save"));
    // Simulate the server's success answer plus the refetch it triggers:
    // booleans only, no key anywhere in the payload.
    const accepted: GooglePlaceCredentialsStatus = {
      placeId: PLACE_ID,
      hasPlacesApiKey: true,
      hasMapsEmbedApiKey: false,
      placesApiKeyUpdatedAt: "2026-11-05T03:00:00Z",
      mapsEmbedApiKeyUpdatedAt: null,
      credentialsSource: "affiliate",
    };
    statusState.current = { data: accepted, isLoading: false, error: null };
    act(() => {
      mutationOptions.current?.onSuccess?.(accepted);
    });

    const afterSave = screen.getByTestId("google-places-key-saved");
    expect(afterSave.textContent).toContain("Key saved");
    // The key input is gone, and with it the value.
    expect(screen.queryByLabelText(/Places API key/i)).toBeNull();
    expect(document.body.innerHTML).not.toContain(PLACES_KEY);
  });

  it("never renders a saved key, not even masked, once it is on file", () => {
    statusState.current = {
      data: {
        placeId: PLACE_ID,
        hasPlacesApiKey: true,
        hasMapsEmbedApiKey: true,
        placesApiKeyUpdatedAt: "2026-11-05T03:00:00Z",
        mapsEmbedApiKeyUpdatedAt: "2026-11-05T03:00:00Z",
        credentialsSource: "affiliate",
      },
      isLoading: false,
      error: null,
    };
    renderPanel({ googlePlaceId: PLACE_ID });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Key saved");
    // No masked placeholder, no asterisks, no last-four.
    expect(document.body.innerHTML).not.toMatch(/•{3,}|\*{3,}|AIza/);
    // Both inputs are gone until the affiliate chooses Replace.
    expect(screen.queryByDisplayValue(/AIza/)).toBeNull();
  });

  it("sends only a replacement when the affiliate presses Replace", () => {
    statusState.current = {
      data: {
        placeId: PLACE_ID,
        hasPlacesApiKey: true,
        hasMapsEmbedApiKey: false,
        placesApiKeyUpdatedAt: null,
        mapsEmbedApiKeyUpdatedAt: null,
        credentialsSource: "affiliate",
      },
      isLoading: false,
      error: null,
    };
    renderPanel({ googlePlaceId: PLACE_ID });

    fireEvent.click(screen.getAllByRole("button", { name: /^Replace$/ })[0]);
    fireEvent.change(screen.getByLabelText(/Places API key/i), { target: { value: PLACES_KEY } });
    fireEvent.click(screen.getByTestId("google-reviews-save"));

    expect(mutate.mock.calls[0][0]).toMatchObject({
      placeId: PLACE_ID,
      placesApiKey: PLACES_KEY,
    });
    expect(mutate.mock.calls[0][0]).not.toHaveProperty("clearPlacesApiKey");
  });

  it("removes a saved key without ever reading it", () => {
    statusState.current = {
      data: {
        placeId: PLACE_ID,
        hasPlacesApiKey: true,
        hasMapsEmbedApiKey: true,
        placesApiKeyUpdatedAt: null,
        mapsEmbedApiKeyUpdatedAt: null,
        credentialsSource: "affiliate",
      },
      isLoading: false,
      error: null,
    };
    renderPanel({ googlePlaceId: PLACE_ID });

    const removeButtons = screen.getAllByRole("button", { name: /^Remove$/ });
    fireEvent.click(removeButtons[0]);

    expect(mutate.mock.calls[0][0]).toEqual({ placeId: PLACE_ID, clearPlacesApiKey: true });
  });

  it("rejects a key that is not Google-shaped before it is sent", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Places API key/i), { target: { value: "sk-not-a-google-key" } });

    const saveButton = screen.getByTestId("google-reviews-save") as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(document.body.textContent).toContain("should start with");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the platform-fallback state instead of pretending the affiliate key is used", () => {
    probeState.current = {
      data: {
        status: "ok",
        placeId: PLACE_ID,
        placeName: "Sample",
        rating: 4.5,
        userRatingCount: 9,
        reviews: [{ name: "a" }],
        links: { place: null, reviews: null, writeReview: null },
        fetchedAt: "2026-11-05T03:00:00Z",
        embedApiKey: null,
      },
      isLoading: false,
      error: null,
    };
    statusState.current = {
      data: {
        placeId: PLACE_ID,
        hasPlacesApiKey: false,
        hasMapsEmbedApiKey: false,
        placesApiKeyUpdatedAt: null,
        mapsEmbedApiKeyUpdatedAt: null,
        credentialsSource: "platform",
      },
      isLoading: false,
      error: null,
    };
    renderPanel({ googlePlaceId: PLACE_ID });

    expect(document.body.textContent).toContain("using the platform's Google project as a fallback");
    expect(document.body.textContent).toContain("1 Google review ready to show.");
  });

  it("explains that saving needs the API update when the procedure is missing", () => {
    credentialsAvailable.current = false;
    renderPanel({ googlePlaceId: PLACE_ID });
    fireEvent.change(screen.getByLabelText(/Places API key/i), { target: { value: PLACES_KEY } });

    fireEvent.click(screen.getByTestId("google-reviews-save"));
    expect(mutate).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("needs the API server update");
  });

  it("offers step-by-step help on where to find each value", () => {
    renderPanel();

    fireEvent.click(screen.getAllByRole("button", { name: /How to get this key/i })[0]);
    let text = document.body.textContent ?? "";
    expect(text).toContain("Your Places API key");
    expect(text).toContain("APIs & Services → Library");
    expect(text).toContain("Places API (New)");
    expect(text).toContain("Application restrictions choose “None”");

    fireEvent.click(screen.getAllByRole("button", { name: /How to get this key/i })[1]);
    text = document.body.textContent ?? "";
    expect(text).toContain("Your Maps Embed key (optional)");
    expect(text).toContain("Maps Embed API");
    expect(text).toContain("HTTP referrers");

    fireEvent.click(screen.getByRole("button", { name: /Where do I find it\?/i }));
    expect(document.body.textContent).toContain("Your Place ID");
    expect(document.body.textContent).toContain("Place ID Finder");
  });

  it("never persists a typed key in browser storage", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Places API key/i), { target: { value: PLACES_KEY } });

    const dump = JSON.stringify(window.localStorage) + JSON.stringify(window.sessionStorage) + document.cookie;
    expect(dump).not.toContain(PLACES_KEY);
    // And no query param or hidden input carries it.
    expect(window.location.search).not.toContain("AIza");
    expect(document.querySelectorAll(`input[value="${PLACES_KEY}"]`)).toHaveLength(1);
  });

  it("leaves no trace of the key after a successful save", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Places API key/i), { target: { value: PLACES_KEY } });
    fireEvent.click(screen.getByTestId("google-reviews-save"));

    // The key did reach the mutation payload...
    expect(mutate.mock.calls[0][0]).toMatchObject({ placesApiKey: PLACES_KEY });

    const accepted: GooglePlaceCredentialsStatus = {
      placeId: PLACE_ID,
      hasPlacesApiKey: true,
      hasMapsEmbedApiKey: false,
      placesApiKeyUpdatedAt: "2026-11-05T03:00:00Z",
      mapsEmbedApiKeyUpdatedAt: null,
      credentialsSource: "affiliate",
    };
    statusState.current = { data: accepted, isLoading: false, error: null };
    act(() => {
      mutationOptions.current?.onSuccess?.(accepted);
    });

    // ...and then nowhere: not the DOM, not storage, not the URL.
    const stored: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      stored.push(String(window.localStorage.getItem(window.localStorage.key(i) ?? "")));
    }
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      stored.push(String(window.sessionStorage.getItem(window.sessionStorage.key(i) ?? "")));
    }
    expect([...stored, document.cookie, window.location.href].join("|")).not.toContain(PLACES_KEY);
    expect(document.body.innerHTML).not.toContain(PLACES_KEY);
    // And nothing masked or truncated is shown in its place.
    expect(document.body.innerHTML).not.toMatch(/•{3,}|\*{3,}/);
  });

  it("still refuses a Maps link that would need a lookup", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Your Google Place ID or Maps link/i), {
      target: { value: "https://www.google.com/maps/place/Shop/data=!4m2!3m1!1s0x88d9b0a7b4567890:0xa4f25c571acded3f" },
    });
    expect((screen.getByTestId("google-reviews-save") as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain("does not contain the Place ID");
  });
});
