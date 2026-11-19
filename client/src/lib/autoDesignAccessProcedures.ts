// Client side of the Auto Design gate. The procedures below do not exist on
// cabinet-backend yet (see docs/auto-design-subscription-gate.md). Every call
// is disabled while the flag is off, so nothing reaches the server today.
import { trpc } from "@/lib/trpc";
import type { AutoDesignAccessStatus } from "@shared/autoDesignAccess";

type ProcedureError = { message: string };
type Query<T> = { data?: T; isLoading: boolean; refetch: () => Promise<unknown> };
type Mutation<I, O> = { mutateAsync: (input: I) => Promise<O>; isPending: boolean; error: ProcedureError | null };

export interface AutoDesignAccessApi {
  status: { useQuery: (input: undefined, opts: { enabled: boolean; retry: false }) => Query<AutoDesignAccessStatus> };
  requestPhoneCode: { useMutation: () => Mutation<{ phone: string }, { phoneE164: string }> };
  confirmPhoneCode: { useMutation: () => Mutation<{ phone: string; code: string }, { verifiedPhoneE164: string }> };
  recordRun: { useMutation: () => Mutation<{ roomType: string }, AutoDesignAccessStatus> };
  startCheckout: { useMutation: () => Mutation<{ returnPath: string }, { url: string }> };
}

/** Typed view of the planned `autoDesignAccess` router. */
export function useAutoDesignAccessProcedures(): AutoDesignAccessApi {
  return (trpc as unknown as { autoDesignAccess: AutoDesignAccessApi }).autoDesignAccess;
}
