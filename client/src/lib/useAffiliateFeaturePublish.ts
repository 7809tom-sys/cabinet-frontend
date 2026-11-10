import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  anyAffiliateFeaturePublished,
  isPublishedForAffiliate,
  type AffiliateFeaturePublishRow,
  type PublishSubjectKind,
  type TerritorySubjectKind,
} from "@shared/affiliateFeaturePublish";

type QueryError = { message?: string; data?: { code?: string } | null; shape?: { data?: { code?: string } | null; message?: string } | null };

export type AffiliateFeaturePublishStatus = "loading" | "ready" | "missing" | "error";

function procedureMissing(error: QueryError | null | undefined): boolean {
  if (!error) return false;
  const code = error.data?.code ?? error.shape?.data?.code;
  if (code === "NOT_FOUND") return true;
  const message = `${error.message ?? ""} ${error.shape?.message ?? ""}`;
  return /No procedure found on path/i.test(message) || /not found/i.test(message);
}

/**
 * The publish list is an admin read. A missing procedure, a permission
 * refusal (10002), or a signed-out refusal means this caller cannot use it.
 * Affiliate pages then stay open, and each feature read still checks publish
 * on the server. A different failure stays an error so an admin can see it.
 */
export function publishListUnavailable(error: QueryError | null | undefined): boolean {
  if (!error) return false;
  if (procedureMissing(error)) return true;
  const code = error.data?.code ?? error.shape?.data?.code;
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return true;
  const message = `${error.message ?? ""} ${error.shape?.message ?? ""}`;
  return /you do not have required permission/i.test(message)
    || /\(10002\)/.test(message)
    || /please login \(10001\)/i.test(message);
}

export function affiliatePublishListStatus(input: {
  authLoading: boolean;
  canReadPublishList: boolean;
  queryLoading: boolean;
  error: QueryError | null | undefined;
  hasRows: boolean;
}): AffiliateFeaturePublishStatus {
  if (input.authLoading) return "loading";
  if (!input.canReadPublishList) return "missing";
  if (input.queryLoading) return "loading";
  if (publishListUnavailable(input.error)) return "missing";
  if (input.error) return "error";
  return input.hasRows ? "ready" : "missing";
}

type PublishClient = {
  distributorAdmin: {
    listAffiliateFeaturePublish: {
      useQuery: (input: undefined, options?: { retry?: boolean; enabled?: boolean }) => {
        data?: { rows?: AffiliateFeaturePublishRow[] } | AffiliateFeaturePublishRow[];
        isLoading: boolean;
        error: QueryError | null;
      };
    };
    setAffiliateFeaturePublish: {
      useMutation: (options?: {
        onSuccess?: () => void;
        onError?: (error: { message: string }) => void;
      }) => {
        mutate: (input: { subjectKind: PublishSubjectKind; subjectId: number; featureKey: string; published: boolean }) => void;
        isPending: boolean;
      };
    };
  };
  useUtils: () => {
    distributorAdmin: { listAffiliateFeaturePublish: { invalidate: () => void } };
  };
};

export function useAffiliateFeaturePublish() {
  const { user, loading: authLoading } = useAuth();
  const role = (user as { role?: string | null } | null)?.role ?? null;
  const canReadPublishList = role === "admin";
  const client = trpc as unknown as PublishClient;
  const query = client.distributorAdmin.listAffiliateFeaturePublish.useQuery(undefined, {
    retry: false,
    enabled: canReadPublishList,
  });
  const raw = query.data;
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : null;
  const status = affiliatePublishListStatus({
    authLoading,
    canReadPublishList,
    queryLoading: query.isLoading,
    error: query.error,
    hasRows: rows != null,
  });
  const readyRows = status === "ready" ? rows ?? [] : [];
  return {
    status,
    errorMessage: query.error?.message ?? null,
    rows: readyRows,
    anyPublished: (featureKey: string) => anyAffiliateFeaturePublished(readyRows, featureKey, { role }),
    isPublished: (subject: { kind: TerritorySubjectKind; id: number }, featureKey: string) =>
      isPublishedForAffiliate(readyRows, subject, featureKey, { role }),
  };
}

export function useSetAffiliateFeaturePublish(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  const client = trpc as unknown as PublishClient;
  const utils = client.useUtils();
  return client.distributorAdmin.setAffiliateFeaturePublish.useMutation({
    onSuccess: () => {
      utils.distributorAdmin.listAffiliateFeaturePublish.invalidate();
      options?.onSuccess?.();
    },
    onError: (error) => options?.onError?.(error),
  });
}
