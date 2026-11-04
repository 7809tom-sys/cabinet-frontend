import { trpc } from "@/lib/trpc";
import {
  acceptedAppearanceUnavailable,
  shouldRetryAcceptedAppearance,
  type AcceptedAppearanceRow,
} from "@/lib/acceptedDoorAppearance";

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown> | void;
};

type AcceptedAppearanceQuery = QueryResult<AcceptedAppearanceRow | AcceptedAppearanceRow[]>;

/**
 * `doorStyles.acceptedAppearance` ships in a separate cabinet-backend PR. Cast
 * until AppRouter carries it, so this build compiles and runs either way.
 */
function api() {
  return trpc as unknown as {
    doorStyles: {
      acceptedAppearance?: {
        useQuery: (input: { styleIds: number[] }, options?: object) => AcceptedAppearanceQuery;
      };
    };
  };
}

/** The endpoint answers one row for `styleId` and a list for `styleIds`. Always work with a list. */
export function toAcceptedAppearanceRows(data: AcceptedAppearanceRow | AcceptedAppearanceRow[] | undefined | null): AcceptedAppearanceRow[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** True when this build's router does not carry the procedure at all. */
export function acceptedAppearanceProcedureMissing(): boolean {
  return !api().doorStyles?.acceptedAppearance;
}

/**
 * The accepted appearance of every style a plan references, in one query.
 *
 * Three cases, all safe:
 *
 *   1. the endpoint answers rows -> the accepted render drives each style's color;
 *   2. the endpoint answers NOT_FOUND because the backend PR is not deployed yet
 *      -> `unavailable` is true and the caller falls back to the pre-paint-match
 *      original, never to the paint-match hex;
 *   3. the procedure is absent from this build's router -> same fallback, and no
 *      request is made at all.
 *
 * Nothing here throws. A Designer that cannot read the approval still renders.
 */
export function useAcceptedDoorAppearance(styleIds: readonly number[]) {
  const ids = Array.from(new Set(styleIds.filter((id) => Number.isInteger(id) && id > 0))).sort((left, right) => left - right);
  const procedure = api().doorStyles?.acceptedAppearance;
  const enabled = ids.length > 0 && Boolean(procedure);
  const query = procedure
    ? procedure.useQuery(
      { styleIds: ids },
      {
        enabled,
        staleTime: 30_000,
        throwOnError: false,
        retry: (failureCount: number, error: unknown) => shouldRetryAcceptedAppearance(failureCount, error),
      },
    )
    : null;
  const unavailable = !procedure
    || Boolean(query?.isError && acceptedAppearanceUnavailable(query.error));
  return {
    rows: toAcceptedAppearanceRows(query?.data),
    isLoading: Boolean(query?.isLoading && enabled),
    unavailable,
    /** True for any failure that is not the endpoint simply not existing yet. */
    failed: Boolean(query?.isError && !unavailable),
    refetch: query?.refetch,
  };
}
