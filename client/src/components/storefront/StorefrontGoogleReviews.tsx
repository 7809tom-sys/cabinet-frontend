import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Flag, MapPin, Quote, Star } from "lucide-react";
import {
  GOOGLE_MAPS_ATTRIBUTION_TEXT,
  GOOGLE_REVIEWS_EMPTY_NOTICE,
  GOOGLE_REVIEWS_ORDER_NOTICE,
  GOOGLE_REVIEWS_VERIFICATION_NOTICE,
  GOOGLE_REVIEW_TRANSLATED_NOTICE,
  googleMapEmbedUrl,
  googleReadReviewsUrl,
  googleWriteReviewUrl,
  toReviewViews,
  type GoogleReviewView,
} from "@shared/googleReviews";
import { useGoogleReviewsQuery } from "@/lib/googleReviewsProcedures";
import type { StringKey } from "@/lib/storefrontI18n";

type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

type Props = {
  placeId: string;
  storeName: string;
  brand: { primary: string; accent: string };
  t: Translate;
  lang: string;
};

/**
 * Google Maps attribution.
 *
 * Google's Places policies require the attribution to sit near the content, in
 * the same visual container, clearly visible, unmodified, on one line, and never
 * translated. The typography below follows their published table (Roboto or a
 * sans-serif fallback, weight 400, grey #5E5E5E, 12–16sp, no letter spacing).
 * The text form is explicitly allowed where the logo does not fit, and we use it
 * rather than shipping a modified copy of Google's logo files.
 */
function GoogleMapsAttribution({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      translate="no"
      data-testid="google-maps-attribution"
      style={{
        fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
        fontStyle: "normal",
        fontWeight: 400,
        fontSize: "0.875rem",
        letterSpacing: "normal",
        color: "#5E5E5E",
        whiteSpace: "nowrap",
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" focusable="false">
        <path
          fill="#4285F4"
          d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
        />
      </svg>
      {GOOGLE_MAPS_ATTRIBUTION_TEXT}
    </span>
  );
}

function Stars({ rating, accent }: { rating: number | null; accent: string }) {
  if (rating == null) return null;
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          aria-hidden="true"
          className="h-3.5 w-3.5"
          style={{
            color: accent,
            fill: index <= rounded ? accent : "transparent",
            opacity: index <= rounded ? 1 : 0.35,
          }}
        />
      ))}
    </span>
  );
}

/**
 * One review, rendered exactly as Google returned it.
 *
 * Nothing here is trimmed, reworded, or reordered, and a low rating is shown
 * like any other. Author attribution (avatar, name, profile link), the link to
 * the review on Google Maps, and Google's own report link are all required by
 * Google's Places policies.
 */
function ReviewCard({
  review,
  accent,
  t,
}: {
  review: GoogleReviewView;
  accent: string;
  t: Translate;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const initials = review.authorName.slice(0, 1).toUpperCase();
  return (
    <figure
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5"
      data-testid="google-review"
    >
      <figcaption className="flex items-start gap-3">
        {review.authorPhotoUrl ? (
          <img
            src={review.authorPhotoUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {review.authorProfileUrl ? (
              <a
                href={review.authorProfileUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline"
              >
                {review.authorName}
              </a>
            ) : (
              <span className="truncate text-sm font-semibold text-foreground">{review.authorName}</span>
            )}
            <Stars rating={review.rating} accent={accent} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {review.relativeDate ? (
              <time dateTime={review.publishTime ?? undefined}>{review.relativeDate}</time>
            ) : null}
            {review.visitDate ? <span>{t("reviews_visited", { month: review.visitDate })}</span> : null}
          </div>
        </div>
      </figcaption>

      {review.translated ? (
        <p className="mt-3 text-xs font-medium text-muted-foreground">{GOOGLE_REVIEW_TRANSLATED_NOTICE}</p>
      ) : null}

      {/* Whitespace is preserved so the reviewer's own line breaks survive. */}
      <blockquote className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
        {showOriginal && review.originalText ? review.originalText : review.text}
      </blockquote>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {review.originalText ? (
          <button
            type="button"
            onClick={() => setShowOriginal((current) => !current)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {showOriginal ? t("reviews_translated") : t("reviews_original")}
          </button>
        ) : null}
        {review.googleMapsUri ? (
          <a
            href={review.googleMapsUri}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("reviews_source")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : null}
        {review.flagContentUri ? (
          <a
            href={review.flagContentUri}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"
          >
            <Flag className="h-3 w-3" aria-hidden="true" /> {t("reviews_report")}
          </a>
        ) : null}
      </div>
    </figure>
  );
}

function LinkButton({
  href,
  children,
  variant,
  brand,
}: {
  href: string;
  children: React.ReactNode;
  variant: "primary" | "outline";
  brand: { primary: string; accent: string };
}) {
  const style = variant === "primary"
    ? { backgroundColor: brand.accent, color: "#fff" }
    : { borderColor: brand.primary, color: brand.primary };
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${
        variant === "primary" ? "" : "border bg-transparent"
      }`}
      style={style}
    >
      {children}
    </a>
  );
}

/**
 * Public "Google reviews" section for an affiliate storefront.
 *
 * Renders nothing at all unless the affiliate has saved a place ID, so a store
 * that never connected Google never shows an empty or fake review block. With a
 * place ID it renders the official Maps Embed iframe (when an embed key is
 * available), whatever reviews Google returns — never more than five, never
 * reordered — and the two outbound links.
 */
export function StorefrontGoogleReviews({ placeId, storeName, brand, t, lang }: Props) {
  const query = useGoogleReviewsQuery(placeId, Boolean(placeId));
  const result = query.data;

  const embedUrl = useMemo(() => {
    const key = result?.status === "ok" ? result.embedApiKey : null;
    return googleMapEmbedUrl(placeId, key, { language: lang });
  }, [placeId, result, lang]);

  const reviews = useMemo(
    () => (result?.status === "ok" ? toReviewViews(result.reviews) : []),
    [result],
  );

  if (!placeId) return null;

  const placeName = result?.status === "ok" ? result.placeName : null;
  const links = result?.status === "ok" ? result.links : null;
  const readReviewsUrl = links?.reviews || googleReadReviewsUrl(placeId, placeName ?? storeName);
  const writeReviewUrl = links?.writeReview || googleWriteReviewUrl(placeId);
  const average = result?.status === "ok" ? result.rating : null;
  const ratingCount = result?.status === "ok" ? result.userRatingCount : null;

  return (
    <section
      id="google-reviews"
      aria-labelledby="storefront-google-reviews"
      className="border-b border-border bg-background py-14 md:py-16"
      data-testid="storefront-google-reviews"
    >
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: brand.accent }}>
            {t("reviews_eyebrow")}
          </p>
          <h2
            id="storefront-google-reviews"
            className="mt-2 text-3xl font-bold tracking-tight text-foreground"
          >
            {t("reviews_title")}
          </h2>
          {average != null ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <Stars rating={average} accent={brand.accent} />
              <span className="font-semibold text-foreground">{t("reviews_avg", { rating: average.toFixed(1) })}</span>
              {ratingCount != null ? <span>{t("reviews_count", { count: ratingCount })}</span> : null}
            </p>
          ) : null}
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            {embedUrl ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <iframe
                  title={t("reviews_map_title")}
                  src={embedUrl}
                  width="100%"
                  height="320"
                  // The Embed API documents these attributes: fullscreen, no
                  // border, and a referrer policy that lets the referrer-based
                  // key restriction validate while keeping paths private.
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={{ border: 0, minHeight: 200, minWidth: 200, display: "block" }}
                  data-testid="google-maps-embed"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <LinkButton href={readReviewsUrl} variant="primary" brand={brand}>
                {t("reviews_see_all")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </LinkButton>
              <LinkButton href={writeReviewUrl} variant="outline" brand={brand}>
                {t("reviews_write")}
              </LinkButton>
            </div>

            {!embedUrl && result?.status === "ok" ? (
              <a
                href={links?.place || readReviewsUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" /> {placeName || storeName}
              </a>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <p className="text-sm font-semibold text-foreground">{t("reviews_title")}</p>
              <GoogleMapsAttribution />
            </div>

            {reviews.length > 0 ? (
              <div className="mt-4 grid gap-4">
                {reviews.map((review) => (
                  <ReviewCard key={review.key} review={review} accent={brand.accent} t={t} />
                ))}
                <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                  <p>{t("reviews_order_notice")}</p>
                  <p>{t("reviews_verified_notice")}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Quote className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {result?.status === "unavailable" ? t("reviews_error") : t("reviews_empty")}
                </p>
              </div>
            )}

            <div className="mt-4 border-t border-border pt-3">
              <GoogleMapsAttribution />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
