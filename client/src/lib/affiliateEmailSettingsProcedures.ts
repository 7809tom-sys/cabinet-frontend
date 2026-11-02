import { trpc } from "@/lib/trpc";
import type {
  AffiliateEmailSettingsTestInput,
  AffiliateEmailSettingsTestResult,
  AffiliateEmailSettingsUpdateInput,
  AffiliateEmailSettingsView,
} from "@shared/affiliateEmailSettings";

type QueryOptions = { retry?: boolean; enabled?: boolean };

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  error: { message: string; data?: { code?: string } | null } | null;
  refetch: () => Promise<unknown> | void;
};

type ProcedureError = { message: string; data?: { code?: string } | null };

// Expected cabinet-backend contract (being built in a parallel PR):
//
//   affiliateEmailSettings.get      ({ affiliateId }) -> AffiliateEmailSettingsView
//   affiliateEmailSettings.update   (AffiliateEmailSettingsUpdateInput) -> AffiliateEmailSettingsView
//   affiliateEmailSettings.sendTest ({ affiliateId }) -> { ok, to, error }
//
// get and update are owner/admin only for that affiliate: the server resolves
// the caller's own affiliate or their owner membership, or role === "admin".
// update keeps the stored app password when `appPassword` is omitted and never
// returns it, only `hasAppPassword`. sendTest uses the saved settings and
// returns the provider's exact error string when the send fails.
//
// Cast until AppRouter includes these procedures. Then delete this file and
// call trpc.affiliateEmailSettings directly.
export function useAffiliateEmailSettingsProcedures() {
  return trpc as unknown as {
    affiliateEmailSettings: {
      get: {
        useQuery: (input: { affiliateId: number }, options?: QueryOptions) => QueryResult<AffiliateEmailSettingsView>;
      };
      update: {
        useMutation: (options?: {
          onSuccess?: (result: AffiliateEmailSettingsView, input: AffiliateEmailSettingsUpdateInput) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutate: (input: AffiliateEmailSettingsUpdateInput) => void;
          isPending: boolean;
        };
      };
      sendTest: {
        useMutation: (options?: {
          onMutate?: () => void;
          onSettled?: () => void;
          onSuccess?: (result: AffiliateEmailSettingsTestResult, input: AffiliateEmailSettingsTestInput) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutate: (input: AffiliateEmailSettingsTestInput) => void;
          isPending: boolean;
        };
      };
    };
    useUtils: () => {
      affiliateEmailSettings: {
        get: { invalidate: (input?: { affiliateId: number }) => Promise<void> };
      };
    };
  };
}
