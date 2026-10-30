import { trpc } from "@/lib/trpc";
import type {
  AffiliateContractorRequest,
  ContractorAccessListRow,
  SubmitForContractorInput,
  SubmitForContractorResult,
} from "@/lib/contractorAccessForm";

type QueryOptions = { retry?: boolean; enabled?: boolean };

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown> | void;
};

type ListInput = { status?: "pending" | "approved" | "rejected" | "denied"; submittedByUserId?: number };

// submitForContractor, myAffiliateRequests, and the contractorAccess.list
// fields source / submittedByUserId / submittedByName / submittedByEmail /
// contractorName / contractorEmail ship in the paired cabinet-backend PR.
// Cast until AppRouter includes them. Then delete this file and call
// trpc.contractorAccess directly.
export function useContractorAccessProcedures() {
  return trpc as unknown as {
    contractorAccess: {
      submitForContractor: {
        useMutation: (options?: {
          onSuccess?: (result: SubmitForContractorResult) => void;
          onError?: (error: { message: string }) => void;
        }) => {
          mutate: (input: SubmitForContractorInput) => void;
          isPending: boolean;
        };
      };
      myAffiliateRequests: {
        useQuery: (input?: { affiliateId?: number }, options?: QueryOptions) => QueryResult<AffiliateContractorRequest[]>;
      };
      list: {
        useQuery: (input?: ListInput, options?: QueryOptions) => QueryResult<ContractorAccessListRow[]>;
      };
    };
    useUtils: () => {
      contractorAccess: {
        list: { invalidate: () => Promise<void> };
        myAffiliateRequests: { invalidate: () => Promise<void> };
      };
    };
  };
}
