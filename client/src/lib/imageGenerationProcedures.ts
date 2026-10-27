import { trpc } from "@/lib/trpc";
import type {
  CustomerGeneratedImage,
  ImageCustomerOption,
  ImageGenerationSummary,
} from "@/components/imageCustomer/imageGenerationTypes";

// imageGenerations ships with the backend patch. Cast until AppRouter includes it.
export function useImageGenerationProcedures() {
  return trpc as unknown as {
    imageGenerations: {
      summary: {
        useQuery: (
          input?: { from?: string; to?: string },
          options?: { retry?: boolean },
        ) => {
          data?: ImageGenerationSummary;
          isLoading: boolean;
          error: { message: string } | null;
          refetch: () => void;
        };
      };
      forCustomer: {
        useQuery: (
          input: { customerId: number; customerKind: "user" | "crm"; limit?: number },
          options?: { enabled?: boolean; retry?: boolean },
        ) => {
          data?: { schemaReady: boolean; images: CustomerGeneratedImage[] };
          isLoading: boolean;
          error: { message: string } | null;
        };
      };
      search: {
        useQuery: (
          input?: { query?: string },
          options?: { enabled?: boolean; retry?: boolean },
        ) => {
          data?: { customers: ImageCustomerOption[] };
          isFetching: boolean;
        };
      };
      quickAdd: {
        useMutation: () => {
          mutateAsync: (input: { name: string; email?: string; phone?: string }) => Promise<{
            customerId: number;
            customerKind: "crm";
            name: string;
          }>;
          isPending: boolean;
        };
      };
    };
  };
}
