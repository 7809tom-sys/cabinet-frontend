import { trpc } from "@/lib/trpc";
import type { ContractorPortalScope } from "@/lib/contractorScope";

type QueryOptions = { retry?: boolean; enabled?: boolean };

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown> | void;
};

type MutationError = { message: string };

export type ContractorCustomerRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type ContractorDesignRow = {
  id: number;
  name: string;
  projectName: string | null;
  roomLabel: string | null;
  roomType: string | null;
  thumbnailUrl: string | null;
  updatedAt: string | Date;
  contractorCustomerId: number | null;
};

export type ContractorCustomerInput = {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  contractorUserId?: number;
};

export type AssignDesignInput = {
  designId: number;
  customerId: number | null;
  contractorUserId?: number;
};

// contractorPortal list/create/assign accept optional contractorUserId for an
// admin viewing that contractor. Cast until AppRouter includes it.
export function useContractorPortalProcedures() {
  return trpc as unknown as {
    contractorPortal: {
      customers: {
        list: {
          useQuery: (input?: ContractorPortalScope, options?: QueryOptions) => QueryResult<ContractorCustomerRow[]>;
        };
        create: {
          useMutation: (options?: {
            onSuccess?: () => void;
            onError?: (error: MutationError) => void;
          }) => {
            mutate: (input: ContractorCustomerInput) => void;
            isPending: boolean;
          };
        };
      };
      designs: {
        list: {
          useQuery: (input?: ContractorPortalScope, options?: QueryOptions) => QueryResult<ContractorDesignRow[]>;
        };
        assign: {
          useMutation: (options?: {
            onSuccess?: () => void;
            onError?: (error: MutationError) => void;
          }) => {
            mutate: (input: AssignDesignInput) => void;
            isPending: boolean;
          };
        };
      };
    };
  };
}
