import { trpc } from "@/lib/trpc";
import type { DesignerSubscriptionTier } from "@shared/designerSubscriptionTiers";

type ProcedureError = { message: string };

export type MyDesignerSubscription = {
  tier: DesignerSubscriptionTier;
  status: "active" | "past_due" | "cancelled";
  amountCents: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

// Cast until AppRouter includes these procedures. The cabinet-backend branch
// feat/subscription-tiers-1199-1599 adds the designerSubscription router. A
// missing procedure answers NOT_FOUND; the plans page still renders both
// tiers from shared/designerSubscriptionTiers.ts.
export function useDesignerSubscriptionProcedures() {
  return trpc as unknown as {
    useUtils: () => { designerSubscription: { mine: { invalidate: () => Promise<void> } } };
    designerSubscription: {
      mine: {
        useQuery: (
          input?: undefined,
          options?: { retry?: boolean; enabled?: boolean },
        ) => { data?: MyDesignerSubscription | null; isLoading: boolean };
      };
      startCheckout: {
        useMutation: (options?: {
          onSuccess?: (result: { url: string; sessionId: string }) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutate: (input: { tier: DesignerSubscriptionTier }) => void;
          isPending: boolean;
          variables?: { tier: DesignerSubscriptionTier };
        };
      };
      cancel: {
        useMutation: (options?: {
          onSuccess?: (result: { ok: boolean; accessUntil: string | null }) => void;
          onError?: (error: ProcedureError) => void;
        }) => { mutate: () => void; isPending: boolean };
      };
    };
  };
}
