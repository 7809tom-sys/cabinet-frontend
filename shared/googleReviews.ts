/**
 * Google reviews for affiliate storefronts — parsing, links, and display rules.
 *
 * Everything here is pure so the affiliate portal, the public storefront, and
 * the tests read the same rules. Nothing in this file holds an API key.
 *
 * The display rules follow Google's current Places API policies
 * (see GOOGLE_REVIEWS_SOURCES for the exact documents):
 *
 * - Credit the author of every review (avatar, name, profile link).
 * - Every review links to its own page on Google Maps (googleMapsUri) and, when
 *   Google supplies it, to Google's own content-report form (flagContentUri).
 * - Review text is shown exactly as Google returned it. It is never edited,
 *   trimmed into a different claim, reordered, or filtered by rating.
 * - Show the relative publish date and say how the list is ordered.
 * - Show Google Maps attribution, unmodified, next to the content.
 * - The list is whatever Google returned: at most 5 reviews, in Google's order.
 */

// ─── Official sources ────────────────────────────────────────────────────────

export const GOOGLE_REVIEWS_SOURCES = {
  placesPolicies: "https://developers.google.com/maps/documentation/places/web-service/policies",
  placeDetails: "https://developers.google.com/maps/documentation/places/web-service/place-details",
  placeIds: "https://developers.google.com/maps/documentation/places/web-service/place-id",
  mapsLinks: "https://developers.google.com/maps/documentation/places/web-service/maps-links",
  mapsPlatformTerms: "https://cloud.google.com/maps-platform/terms",
  mapsServiceTerms: "https://cloud.google.com/maps-platform/terms/maps-service-terms",
  embedOverview: "https://developers.google.com/maps/documentation/embed/get-started",
  embedMaps: "https://developers.google.com/maps/documentation/embed/embedding-map",
  writeReviewLink: "https://support.google.com/business/answer/16816815?hl=en",
  reviewTips: "https://support.google.com/business/answer/7035772?hl=en",
  ugcPolicy: "https://support.google.com/contributionpolicy/answer/7400114?hl=en",
  localListings: "https://support.google.com/local-listings/answer/9851099?hl=en",
  ftcEndorsementGuides: "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255",
  ftcReviewRule: "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465",
} as const;

// ─── What the Places API gives us ────────────────────────────────────────────

/** Places API (New) returns at most this many reviews. We never request more. */
export const GOOGLE_REVIEWS_MAX_RETURNED = 5;

/**
 * The field mask the API server must request for Place Details (New).
 * `reviews` sits in the Enterprise + Atmosphere SKU; the rest are the fields the
 * display rules require (name, rating summary, and the Google Maps links).
 */
export const GOOGLE_PLACES_FIELD_MASK = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "googleMapsLinks",
  "reviews",
].join(",");

/** The author attribution Google returns with every review. */
export type GoogleReviewAuthor = {
  displayName?: string | null;
  uri?: string | null;
  photoUri?: string | null;
};

export type GoogleLocalizedText = {
  text?: string | null;
  languageCode?: string | null;
};

export type GoogleReviewVisitDate = {
  year?: number | null;
  month?: number | null;
  day?: number | null;
};

/** One review exactly as the Places API (New) returned it. */
export type GooglePlacesReview = {
  name?: string | null;
  relativePublishTimeDescription?: string | null;
  text?: GoogleLocalizedText | null;
  originalText?: GoogleLocalizedText | null;
  rating?: number | null;
  authorAttribution?: GoogleReviewAuthor | null;
  publishTime?: string | null;
  flagContentUri?: string | null;
  googleMapsUri?: string | null;
  visitDate?: GoogleReviewVisitDate | null;
};

export type GoogleMapsLinks = {
  placeUri?: string | null;
  directionsUri?: string | null;
  writeAReviewUri?: string | null;
  reviewsUri?: string | null;
  photosUri?: string | null;
};

// ─── Place input parsing ─────────────────────────────────────────────────────

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,512}$/;
const PLACE_ID_PREFIX = "place_id:";
const GOOGLE_HOST_SUFFIXES = ["google.com", "googleusercontent.com", "goo.gl", "g.page"];

export type GooglePlaceInputFailure =
  | "empty"
  | "invalid"
  | "needs-lookup";

export type GooglePlaceInputResult =
  | { ok: true; placeId: string; from: "place-id" | "maps-link" }
  | { ok: false; code: GooglePlaceInputFailure; message: string };

function isGoogleHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  return GOOGLE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function placeIdFromValue(value: string): string | null {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.toLowerCase().startsWith(PLACE_ID_PREFIX)
    ? trimmed.slice(PLACE_ID_PREFIX.length)
    : trimmed;
  return PLACE_ID_PATTERN.test(withoutPrefix) ? withoutPrefix : null;
}

/**
 * Read the affiliate's saved value back as a place ID.
 *
 * Only a stored place ID is ever used; it is exempt from Google's caching
 * restrictions, so it is the one thing we are allowed to keep.
 */
export function readStoredGooglePlaceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const direct = placeIdFromValue(value);
  if (direct) return direct;
  const parsed = parseGooglePlaceInput(value);
  return parsed.ok ? parsed.placeId : null;
}

/**
 * Turn what the affiliate pasted into a place ID.
 *
 * A place ID is accepted directly. A Google Maps or Business Profile link is
 * accepted only when it already carries the place ID; links that would need a
 * network lookup (shortened links, `cid=` links, and the `/maps/place/…!1s0x…`
 * form) are rejected with instructions instead of being guessed at.
 */
export function parseGooglePlaceInput(raw: string | null | undefined): GooglePlaceInputResult {
  const value = (raw ?? "").trim();
  if (!value) {
    return {
      ok: false,
      code: "empty",
      message: "Paste your Google Place ID or a Google Maps link that includes it.",
    };
  }

  const direct = placeIdFromValue(value);
  if (direct) return { ok: true, placeId: direct, from: "place-id" };

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return {
      ok: false,
      code: "invalid",
      message: "That does not look like a Place ID or a Google Maps link.",
    };
  }

  if (!isGoogleHost(parsed.hostname)) {
    return {
      ok: false,
      code: "invalid",
      message: "Use a Google Maps link, a Google Business Profile link, or the Place ID itself.",
    };
  }

  for (const key of ["query_place_id", "place_id", "placeid"]) {
    const candidate = placeIdFromValue(parsed.searchParams.get(key) ?? "");
    if (candidate) return { ok: true, placeId: candidate, from: "maps-link" };
  }
  // The Embed API documents a place ID in `q` with the `place_id:` prefix, and
  // Maps links copy that form. A bare `q` is a search term, not an ID.
  const q = (parsed.searchParams.get("q") ?? "").trim();
  if (q.toLowerCase().startsWith(PLACE_ID_PREFIX)) {
    const candidate = placeIdFromValue(q);
    if (candidate) return { ok: true, placeId: candidate, from: "maps-link" };
  }

  // `!1s0x…:0x…` (the place feature ID) and `cid=` are not place IDs. Google
  // only converts them through an API call, so we ask for the Place ID instead
  // of pretending we can derive one.
  const needsLookup = /data=.*!1s0x[0-9a-f]+:0x[0-9a-f]+/i.test(parsed.href)
    || parsed.searchParams.has("cid")
    || parsed.searchParams.has("ludocid")
    || parsed.hostname.replace(/^www\./i, "").toLowerCase() === "goo.gl"
    || parsed.hostname.replace(/^www\./i, "").toLowerCase() === "g.page";
  if (needsLookup) {
    return {
      ok: false,
      code: "needs-lookup",
      message:
        "That Google link does not contain the Place ID. Open the place in Google Maps, use the Place ID finder, and paste the ID that starts with \"ChIJ\".",
    };
  }

  return {
    ok: false,
    code: "needs-lookup",
    message:
      "Copy the link from the place's Google Maps listing after opening it, or paste the Place ID that starts with \"ChIJ\".",
  };
}

// ─── Official links ──────────────────────────────────────────────────────────

/** Google's documented "write a review" link for a Business Profile. */
export function googleWriteReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * A Google Maps link to read the place's reviews.
 *
 * `query_place_id` is the documented way to make a Maps search link resolve to
 * one exact place. When the Places API answered, its own `reviewsUri` is used
 * instead (see `googleReviewsLinks`).
 */
export function googleReadReviewsUrl(placeId: string, placeName?: string | null): string {
  const query = (placeName ?? "").trim() || "reviews";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(placeId)}`;
}

/**
 * The official Maps Embed API URL for a place.
 *
 * The Embed API is free but still requires a key, and that key must be visible
 * to the browser to load the iframe. It is therefore expected to be a separate,
 * HTTP-referrer-restricted Maps key (see docs/rules/GOOGLE_REVIEWS.md). Without
 * a key we show a plain link card — never an undocumented `output=embed` URL.
 */
export function googleMapEmbedUrl(
  placeId: string,
  apiKey: string | null | undefined,
  options?: { language?: string | null },
): string | null {
  const key = (apiKey ?? "").trim();
  if (!key || !placeId) return null;
  const params = new URLSearchParams({
    key,
    q: `place_id:${placeId}`,
    zoom: "15",
    maptype: "roadmap",
  });
  const language = (options?.language ?? "").trim();
  if (language) params.set("language", language);
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

// ─── Review view model ───────────────────────────────────────────────────────

export type GoogleReviewView = {
  /** Google's own id for this review, used as the React key. */
  key: string;
  authorName: string;
  authorProfileUrl: string | null;
  authorPhotoUrl: string | null;
  /** 1–5, or null when Google did not send one. */
  rating: number | null;
  /** The review text Google returned for display (translated when it says so). */
  text: string;
  /** True when Google's displayed text is a translation of the original. */
  translated: boolean;
  /** The author's original wording, offered only alongside a translation. */
  originalText: string | null;
  /** Google's relative date string, e.g. "2 days ago". */
  relativeDate: string | null;
  /** Full timestamp, for the accessible title. */
  publishTime: string | null;
  /** This review on Google Maps — required by Google's display rules. */
  googleMapsUri: string | null;
  /** Google's own report form for this review. */
  flagContentUri: string | null;
  /** Month/year the reviewer visited, for places in France. */
  visitDate: string | null;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthYearLabel(visitDate: GoogleReviewVisitDate | null | undefined): string | null {
  const month = visitDate?.month;
  const year = visitDate?.year;
  if (typeof month !== "number" || typeof year !== "number") return null;
  if (month < 1 || month > 12) return null;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Map Google's reviews to what the card renders.
 *
 * Deliberately NOT filtered: every review Google returned is kept, in the order
 * Google returned it. Dropping a low rating would misrepresent the business and
 * is exactly the practice Google's policies and the FTC review rule prohibit.
 */
export function toReviewViews(reviews: readonly GooglePlacesReview[] | null | undefined): GoogleReviewView[] {
  if (!Array.isArray(reviews)) return [];
  return reviews.slice(0, GOOGLE_REVIEWS_MAX_RETURNED).map((review, index) => {
    const shown = review.text?.text ?? "";
    const original = review.originalText?.text ?? "";
    const shownLanguage = review.text?.languageCode ?? null;
    const originalLanguage = review.originalText?.languageCode ?? null;
    const translated = Boolean(shown && original && shown !== original)
      || Boolean(shownLanguage && originalLanguage && shownLanguage !== originalLanguage);
    return {
      key: review.name?.trim() || `review-${index}`,
      authorName: review.authorAttribution?.displayName?.trim() || "Google reviewer",
      authorProfileUrl: review.authorAttribution?.uri?.trim() || null,
      authorPhotoUrl: review.authorAttribution?.photoUri?.trim() || null,
      rating: typeof review.rating === "number" ? review.rating : null,
      text: shown,
      translated,
      originalText: translated && original && original !== shown ? original : null,
      relativeDate: review.relativePublishTimeDescription?.trim() || null,
      publishTime: review.publishTime?.trim() || null,
      googleMapsUri: review.googleMapsUri?.trim() || null,
      flagContentUri: review.flagContentUri?.trim() || null,
      visitDate: monthYearLabel(review.visitDate),
    };
  });
}

// ─── Copy the display rules require ──────────────────────────────────────────

/** Required: say how the list is ordered and that nothing was filtered. */
export const GOOGLE_REVIEWS_ORDER_NOTICE =
  "Shown in the order Google returned them (most relevant first). We do not filter, edit, or reorder these reviews.";

/** Recommended by Google when showing reviews and an average rating. */
export const GOOGLE_REVIEWS_VERIFICATION_NOTICE =
  "Reviews aren't verified by Google, but Google checks for and removes fake content when it's identified.";

/** The attribution text. Never translated, never wrapped, never restyled. */
export const GOOGLE_MAPS_ATTRIBUTION_TEXT = "Google Maps";

/** Shown above a translated review, per Google's recommendation. */
export const GOOGLE_REVIEW_TRANSLATED_NOTICE = "Translated by Google";

/** Shown when Google sent no reviews for the place. Never filled with samples. */
export const GOOGLE_REVIEWS_EMPTY_NOTICE =
  "Google has no reviews to show for this business yet. Read them all on Google Maps.";

// ─── API contract (cabinet-backend) ──────────────────────────────────────────

/**
 * The procedure the storefront reads. The API lives in the separate
 * `cabinet-backend` repository; this is the agreement between the two.
 */
export const GOOGLE_REVIEWS_PROCEDURE = "googleReviews.bySlug" as const;

/** Server-side key for Place Details (New). Never sent to the browser. */
export const GOOGLE_PLACES_KEY_ENV = "GOOGLE_PLACES_API_KEY" as const;

/**
 * Server-side key for the Maps Embed API. This one IS sent to the browser,
 * because the iframe needs it; it must be restricted by HTTP referrer to the
 * storefront domains. The same Google Cloud key may back both variables when its
 * API and referrer restrictions allow it.
 */
export const GOOGLE_MAPS_EMBED_KEY_ENV = "GOOGLE_MAPS_EMBED_API_KEY" as const;

export const GOOGLE_REVIEWS_KEY_SERVICE =
  "cabinet-backend (Railway: cabinet-backend-production)" as const;

export type GoogleReviewsLinks = {
  place: string | null;
  reviews: string | null;
  writeReview: string | null;
};

/** What `googleReviews.bySlug` returns. */
export type GoogleReviewsResult =
  | {
      status: "ok";
      placeId: string;
      placeName: string | null;
      /** Average rating, when Google returned one. */
      rating: number | null;
      userRatingCount: number | null;
      /** Google's reviews, in Google's order, never more than 5. */
      reviews: GooglePlacesReview[];
      links: GoogleReviewsLinks;
      /** When the API answered. For diagnostics only; nothing is stored. */
      fetchedAt: string;
      /** Referrer-restricted key for the Embed API iframe, or null. */
      embedApiKey: string | null;
    }
  | { status: "not-configured"; message: string }
  | {
      status: "unavailable";
      code: "not-connected" | "invalid-place" | "rate-limited" | "upstream-error";
      message: string;
    };

const UNAVAILABLE_COPY: Record<
  Extract<GoogleReviewsResult, { status: "unavailable" }>["code"],
  string
> = {
  "not-connected": "Google reviews aren't connected for this store yet.",
  "invalid-place": "Google couldn't find that place ID. Check it in the affiliate portal.",
  "rate-limited": "Google is rate-limiting review requests right now. Try again in a moment.",
  "upstream-error": "Google reviews couldn't be loaded just now. Try again in a moment.",
};

export function googleReviewsUnavailableMessage(
  code: Extract<GoogleReviewsResult, { status: "unavailable" }>["code"],
): string {
  return UNAVAILABLE_COPY[code];
}

/** True when the value is one of the codes the procedure may return. */
export function isGoogleReviewsUnavailableCode(
  value: unknown,
): value is Extract<GoogleReviewsResult, { status: "unavailable" }>["code"] {
  return typeof value === "string" && value in UNAVAILABLE_COPY;
}
