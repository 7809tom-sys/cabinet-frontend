/**
 * Admin Legal tab storage.
 *
 * `distributorLegalTerms.list` and `save` ship with
 * docs/patches/cabinet-backend-distributor-legal-terms.patch and the table in
 * docs/sql/0274_distributor_legal_terms.tidb.sql. This checkout's AppRouter
 * does not list them yet, so the client is cast. A missing procedure or a
 * missing table leaves the captured wording on screen and blocks Save.
 */
import { trpc } from "@/lib/trpc";

export type DistributorLegalTermRow = {
  distributorKey: string;
  sectionKey: string;
  bodyText: string | null;
  sourceUrl: string | null;
  capturedOn: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
};

export type DistributorLegalTermSave = {
  distributorKey: string;
  sectionKey: string;
  /** Null puts the captured wording back. A string, including "", is the admin's paste. */
  bodyText: string | null;
  sourceUrl?: string | null;
  capturedOn?: string | null;
};

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown>;
};

type Mutation<TInput> = {
  mutateAsync: (input: TInput) => Promise<unknown>;
  isPending: boolean;
};

function api() {
  return trpc as unknown as {
    distributorLegalTerms: {
      list: { useQuery: (input?: undefined, options?: object) => QueryResult<DistributorLegalTermRow[]> };
      save: { useMutation: () => Mutation<DistributorLegalTermSave> };
    };
  };
}

export function useDistributorLegalTerms() {
  return api().distributorLegalTerms.list.useQuery(undefined, { retry: false, throwOnError: false });
}

export function useSaveDistributorLegalTerm() {
  return api().distributorLegalTerms.save.useMutation();
}
