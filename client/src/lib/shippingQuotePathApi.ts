import { trpc } from "@/lib/trpc";

export type ShippingQuotePathRequest = {
  path: "estimate" | "manual";
  originatorName?: string;
  originatorEmail: string;
  originatorPhone?: string;
  deliveryAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
  };
  orderRequestId?: number | null;
  requestNumber?: string | null;
  pendingCategories: string[];
  knownShippingCents: number;
  pendingLabels: string[];
  lineSummary: string;
  notes?: string | null;
};

type PathMutation = {
  mutateAsync: (input: ShippingQuotePathRequest) => Promise<{ ok: boolean; emailed: boolean; status: string }>;
  isPending: boolean;
};

/**
 * These procedures live in cabinet-backend. The AppRouter type in this repo
 * may not list them yet, so the client is cast. The HTTP path is
 * shippingQuotes.requestEstimate / shippingQuotes.requestManualQuote.
 */
export function useShippingQuotePathMutations(): { requestEstimate: PathMutation; requestManualQuote: PathMutation } {
  const api = trpc as unknown as {
    shippingQuotes: {
      requestEstimate: { useMutation: () => PathMutation };
      requestManualQuote: { useMutation: () => PathMutation };
    };
  };
  return {
    requestEstimate: api.shippingQuotes.requestEstimate.useMutation(),
    requestManualQuote: api.shippingQuotes.requestManualQuote.useMutation(),
  };
}
