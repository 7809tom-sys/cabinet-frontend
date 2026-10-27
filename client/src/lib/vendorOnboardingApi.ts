// vendorOnboarding is added in cabinet-backend#23 and is not on this repo's
// AppRouter yet. Cast the client the same way Stripe Invoices did.
import { trpc } from "@/lib/trpc";
import type {
  AdminListSelection,
  AdminOnboardingRow,
  OnboardingDoor,
  OnboardingRow,
  OnboardingSheetRow,
  OnboardingSummaryCounts,
  SubmitDetailsInput,
} from "@/lib/vendorOnboarding";

export type TrpcClientError = {
  message: string;
  data?: { code?: string } | null;
  shape?: { data?: { code?: string } | null } | null;
};

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: TrpcClientError | null;
  refetch: () => Promise<unknown>;
};

export type IngestInput = {
  distributorId?: number;
  fileName?: string;
  text?: string;
  rows?: OnboardingSheetRow[];
};

export type IngestResult = {
  importId: number;
  line: { id: number; name: string };
  notes: string[];
  summary: OnboardingSummaryCounts;
  flagged: OnboardingRow[];
  doors: OnboardingDoor[];
};

export type SummaryResult = {
  importId: number | null;
  distributorId: number;
  fileName: string | null;
  createdAt: Date | string | null;
  counts: OnboardingSummaryCounts;
};

export type FlaggedResult = {
  importId: number;
  rows: OnboardingRow[];
  doors: OnboardingDoor[];
};

export type SubmitDetailsResult = {
  row: OnboardingRow;
  summary: OnboardingSummaryCounts;
  conflictStatus: "review" | null;
  staysPublic: true | null;
};

export type AdminImport = {
  id: number;
  distributorId: number;
  distributorName: string | null;
  fileName: string | null;
  createdAt: Date | string;
  matched: number;
  flagged: number;
  completed: number;
};

export type AdminListResult = {
  imports: AdminImport[];
  rows: AdminOnboardingRow[];
};

type Mutation<TInput, TOutput> = {
  mutate: (input: TInput) => void;
  isPending: boolean;
};

export type VendorOnboardingApi = {
  useUtils: () => {
    vendorOnboarding: {
      summary: { invalidate: () => Promise<void> };
      flagged: { invalidate: () => Promise<void> };
      adminList: { invalidate: () => Promise<void> };
    };
  };
  vendorOnboarding: {
    ingest: {
      useMutation: (options: {
        onSuccess?: (result: IngestResult, input: IngestInput) => void;
        onError?: (error: TrpcClientError) => void;
      }) => Mutation<IngestInput, IngestResult>;
    };
    summary: {
      useQuery: (input?: { distributorId?: number }) => QueryResult<SummaryResult>;
    };
    flagged: {
      useQuery: (input: { distributorId?: number; importId: number }, options?: { enabled?: boolean }) => QueryResult<FlaggedResult>;
    };
    submitDetails: {
      useMutation: (options: {
        onSuccess?: (result: SubmitDetailsResult, input: SubmitDetailsInput) => void;
        onError?: (error: TrpcClientError) => void;
      }) => Mutation<SubmitDetailsInput, SubmitDetailsResult>;
    };
    adminList: {
      useQuery: (input: AdminListSelection & { limit?: number }) => QueryResult<AdminListResult>;
    };
  };
};

export function useVendorOnboardingApi(): VendorOnboardingApi {
  return trpc as unknown as VendorOnboardingApi;
}
