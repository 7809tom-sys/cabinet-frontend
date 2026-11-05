/**
 * Read-side bridge to the `googleReviews.bySlug` procedure.
 *
 * The procedure lives in the separate `cabinet-backend` repository. This module
 * casts the tRPC client until `AppRouter` carries it, so a frontend build that
 * ships before the API change still renders the section (with the plain "not
 * connected" state) instead of crashing on an unknown router key.
 *
 * Nothing here holds or reads a key. The browser asks for a slug; the server
 * talks to Google.
 */
import { trpc } from "@/lib/trpc";
import {
  GOOGLE_REVIEWS_PROCEDURE,
  type GoogleReviewsResult,
} from "@shared/googleReviews";

type QueryOptions = {
  enabled?: boolean;
  retry?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
};

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  error: { message: string } | null;
};

type GoogleReviewsApi = {
  googleReviews?: {
    bySlug?: {
      useQuery: (input: { slug: string }, options?: QueryOptions) => QueryResult<GoogleReviewsResult>;
    };
  };
};

/**
 * Google's terms forbid caching Places content beyond the allowed window, so the
 * storefront treats every read as fresh: the server owns any short-lived cache
 * and the browser keeps nothing.
 */
export const GOOGLE_REVIEWS_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: false,
  retry: false,
} as const;

/** True when this build's router carries the procedure. */
export function googleReviewsProcedureAvailable(): boolean {
  const api = trpc as unknown as GoogleReviewsApi;
  return Boolean(api.googleReviews?.bySlug);
}

export function useGoogleReviewsQuery(slug: string, enabled = true): QueryResult<GoogleReviewsResult> {
  const api = trpc as unknown as GoogleReviewsApi;
  const query = api.googleReviews?.bySlug?.useQuery(
    { slug },
    { ...GOOGLE_REVIEWS_QUERY_OPTIONS, enabled: enabled && Boolean(slug) },
  );
  if (!query) return { data: undefined, isLoading: false, error: null };
  return { data: query.data, isLoading: query.isLoading, error: query.error };
}

export { GOOGLE_REVIEWS_PROCEDURE };
