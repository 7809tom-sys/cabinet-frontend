import { trpc } from "@/lib/trpc";
import type {
  AffiliateContractorRequest,
  AffiliateMarkupQuery,
  AffiliateMarkupResult,
  AffiliateReviewInput,
  ContractorAccessListRow,
  SetAffiliateMarkupInput,
  SubmitForContractorInput,
  SubmitForContractorResult,
} from "@/lib/contractorAccessForm";

type QueryOptions = { retry?: boolean; enabled?: boolean };

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  error: { message: string; data?: { code?: string } | null } | null;
  refetch: () => Promise<unknown> | void;
};

type ProcedureError = { message: string; data?: { code?: string } | null };

type ListInput = { status?: "pending" | "approved" | "rejected" | "denied"; submittedByUserId?: number };

// submitForContractor, myAffiliateRequests, affiliateReview, affiliateMarkup,
// setAffiliateMarkup, and the contractorAccess.list fields source /
// submittedByUserId / submittedByName / submittedByEmail / contractorName /
// contractorEmail ship in the paired cabinet-backend PR.
// Cast until AppRouter includes them. Then delete this file and call
// trpc.contractorAccess directly.
export function useContractorAccessProcedures() {
  return trpc as unknown as {
    contractorAccess: {
      submitForContractor: {
        useMutation: (options?: {
          onSuccess?: (result: SubmitForContractorResult) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutate: (input: SubmitForContractorInput) => void;
          isPending: boolean;
        };
      };
      myAffiliateRequests: {
        useQuery: (input?: undefined, options?: QueryOptions) => QueryResult<AffiliateContractorRequest[]>;
      };
      affiliateReview: {
        useMutation: (options?: {
          onSuccess?: (result: { ok: true; status: "approved" | "rejected" }, input: AffiliateReviewInput) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutate: (input: AffiliateReviewInput) => void;
          isPending: boolean;
        };
      };
      affiliateMarkup: {
        useQuery: (input?: AffiliateMarkupQuery, options?: QueryOptions) => QueryResult<AffiliateMarkupResult>;
      };
      setAffiliateMarkup: {
        useMutation: (options?: {
          onSuccess?: (result: { ok: true }, input: SetAffiliateMarkupInput) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutate: (input: SetAffiliateMarkupInput) => void;
          isPending: boolean;
        };
      };
      list: {
        useQuery: (input?: ListInput, options?: QueryOptions) => QueryResult<ContractorAccessListRow[]>;
      };
    };
    useUtils: () => {
      contractorAccess: {
        list: { invalidate: () => Promise<void> };
        myAffiliateRequests: { invalidate: () => Promise<void> };
        affiliateMarkup: { invalidate: () => Promise<void> };
      };
    };
  };
}
