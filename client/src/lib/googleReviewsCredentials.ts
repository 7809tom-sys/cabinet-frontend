/**
 * Write-only bridge to the affiliate's own Google credentials.
 *
 * Two procedures, both in the separate `cabinet-backend` repository:
 *
 *   googleReviews.credentials        ({ affiliateId? }) -> GooglePlaceCredentialsStatus
 *   googleReviews.saveCredentials    (GooglePlaceCredentialsInput) -> GooglePlaceCredentialsStatus
 *
 * The read answers booleans and timestamps only. There is no procedure, field,
 * or error path in this file that can return a key value, which is what makes the
 * key write-only from the browser's point of view.
 *
 * Rules this module enforces on the client side:
 *
 * - A typed key is held in React state for the duration of the form only. It is
 *   sent once, then the field is cleared. It is never put in localStorage,
 *   sessionStorage, a cookie, the URL, or a mutation cache key.
 * - Nothing here reads the Vite build environment, so no key can arrive from a
 *   VITE-prefixed variable. Those values are compiled into the browser bundle and
 *   would therefore be a public key; an affiliate key must come from the
 *   affiliate, not from the build.
 */
import { trpc } from "@/lib/trpc";
import {
  GOOGLE_CREDENTIALS_GET_PROCEDURE,
  GOOGLE_CREDENTIALS_SAVE_PROCEDURE,
  type GooglePlaceCredentialsInput,
  type GooglePlaceCredentialsStatus,
} from "@shared/googleReviews";

type QueryOptions = { enabled?: boolean; retry?: boolean; staleTime?: number };

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  error: { message: string } | null;
  refetch?: () => Promise<unknown> | void;
};

type Mutation<TInput, TOutput> = {
  mutate: (input: TInput, options?: {
    onSuccess?: (result: TOutput) => void;
    onError?: (error: { message: string }) => void;
  }) => void;
  isPending: boolean;
};

type GoogleReviewsCredentialsApi = {
  googleReviews?: {
    credentials?: {
      useQuery: (
        input: { affiliateId?: number },
        options?: QueryOptions,
      ) => QueryResult<GooglePlaceCredentialsStatus>;
    };
    saveCredentials?: {
      useMutation: (options?: {
        onSuccess?: (result: GooglePlaceCredentialsStatus) => void;
        onError?: (error: { message: string }) => void;
      }) => Mutation<GooglePlaceCredentialsInput, GooglePlaceCredentialsStatus>;
    };
  };
};

/** True when this build's router carries both credential procedures. */
export function googleCredentialsProceduresAvailable(): boolean {
  const api = trpc as unknown as GoogleReviewsCredentialsApi;
  return Boolean(api.googleReviews?.credentials && api.googleReviews?.saveCredentials);
}

export function useGoogleCredentialsQuery(
  affiliateId: number,
  enabled = true,
): QueryResult<GooglePlaceCredentialsStatus> {
  const api = trpc as unknown as GoogleReviewsCredentialsApi;
  const query = api.googleReviews?.credentials?.useQuery(
    { affiliateId },
    // A key can be saved on another tab or by an admin, so the status is not kept
    // stale; it is cheap (booleans, no Google call).
    { enabled: enabled && Boolean(affiliateId), retry: false, staleTime: 0 },
  );
  if (!query) return { data: undefined, isLoading: false, error: null };
  return query;
}

export function useSaveGoogleCredentialsMutation(options?: {
  onSuccess?: (result: GooglePlaceCredentialsStatus) => void;
  onError?: (error: { message: string }) => void;
}) {
  const api = trpc as unknown as GoogleReviewsCredentialsApi;
  const mutation = api.googleReviews?.saveCredentials?.useMutation(options);
  return mutation ?? null;
}

/**
 * Build the payload for one save.
 *
 * A key is included only when the affiliate actually typed one, so an untouched
 * "Replace key" box can never blank out a key that is already saved.
 */
export function googleCredentialsPayload(args: {
  affiliateId?: number;
  placeId: string | null;
  placesApiKey?: string | null;
  mapsEmbedApiKey?: string | null;
  clearPlacesApiKey?: boolean;
  clearMapsEmbedApiKey?: boolean;
}): GooglePlaceCredentialsInput {
  const payload: GooglePlaceCredentialsInput = {
    placeId: args.placeId,
  };
  if (args.affiliateId) payload.affiliateId = args.affiliateId;

  const placesKey = (args.placesApiKey ?? "").trim();
  if (placesKey) payload.placesApiKey = placesKey;
  const embedKey = (args.mapsEmbedApiKey ?? "").trim();
  if (embedKey) payload.mapsEmbedApiKey = embedKey;

  if (args.clearPlacesApiKey) {
    payload.clearPlacesApiKey = true;
    // A replacement supersedes a clear; never send both for one field.
    delete payload.placesApiKey;
  }
  if (args.clearMapsEmbedApiKey) {
    payload.clearMapsEmbedApiKey = true;
    delete payload.mapsEmbedApiKey;
  }
  return payload;
}

export { GOOGLE_CREDENTIALS_GET_PROCEDURE, GOOGLE_CREDENTIALS_SAVE_PROCEDURE };
