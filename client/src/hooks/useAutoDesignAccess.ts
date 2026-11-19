import { useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { autoDesignAccessConfig, autoDesignSubscriptionGateEnabled } from "@/lib/autoDesignAccessFlag";
import { useAutoDesignAccessProcedures } from "@/lib/autoDesignAccessProcedures";
import { decideAutoDesignRun, type AutoDesignAccessStatus, type AutoDesignRunDecision } from "@shared/autoDesignAccess";

/**
 * Gate for the Auto Design Build action. With the flag off (default) every run
 * is allowed and no request is made. With it on, the server status (signed in,
 * verified phone, subscription, runs on that phone) decides.
 */
export function useAutoDesignAccess() {
  const gateEnabled = autoDesignSubscriptionGateEnabled();
  const config = autoDesignAccessConfig();
  const { user } = useAuth();
  const api = useAutoDesignAccessProcedures();
  const statusQuery = api.status.useQuery(undefined, { enabled: gateEnabled && Boolean(user), retry: false });
  const recordRun = api.recordRun.useMutation();

  const status: AutoDesignAccessStatus | null = gateEnabled
    ? (user ? statusQuery.data ?? { signedIn: true, verifiedPhoneE164: null, hasActiveSubscription: false, runsForPhone: 0 } : null)
    : null;
  const decision: AutoDesignRunDecision = decideAutoDesignRun(gateEnabled, status, config);

  /** Call after a successful build so the server counts the run against the phone. */
  const noteRun = useCallback(async (roomType: string) => {
    if (!gateEnabled) return;
    try {
      await recordRun.mutateAsync({ roomType });
    } finally {
      await statusQuery.refetch();
    }
  }, [gateEnabled, recordRun, statusQuery]);

  return { gateEnabled, config, decision, status, loading: gateEnabled && statusQuery.isLoading, refetch: statusQuery.refetch, noteRun };
}
