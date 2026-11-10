import { trpc } from "@/lib/trpc";
import {
  anyAffiliateFeaturePublished,
  isPublishedForAffiliate,
  type AffiliateFeaturePublishRow,
  type PublishSubjectKind,
} from "@shared/affiliateFeaturePublish";

type QueryError = { message?: string; data?: { code?: string } | null; shape?: { data?: { code?: string } | null; message?: string } | null };

function procedureMissing(error: QueryError | null | undefined): boolean {
  if (!error) return false;
  const code = error.data?.code ?? error.shape?.data?.code;
  if (code === "NOT_FOUND") return true;
  const message = `${error.message ?? ""} ${error.shape?.message ?? ""}`;
  return /No procedure found on path/i.test(message) || /not found/i.test(message);
}

type PublishClient = {
  distributorAdmin: {
    listAffiliateFeaturePublish: {
      useQuery: (input: undefined, options?: { retry?: boolean }) => {
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

export type AffiliateFeaturePublishStatus = "loading" | "ready" | "missing" | "error";

export function useAffiliateFeaturePublish() {
  const client = trpc as unknown as PublishClient;
  const query = client.distributorAdmin.listAffiliateFeaturePublish.useQuery(undefined, { retry: false });
  const raw = query.data;
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : null;
  const missing = procedureMissing(query.error);
  const status: AffiliateFeaturePublishStatus = query.isLoading
    ? "loading"
    : missing
      ? "missing"
      : query.error
        ? "error"
        : rows
          ? "ready"
          : "missing";
  const readyRows = status === "ready" ? rows ?? [] : [];
  return {
    status,
    errorMessage: query.error?.message ?? null,
    rows: readyRows,
    anyPublished: (featureKey: string) => anyAffiliateFeaturePublished(readyRows, featureKey),
    isPublished: (subject: { kind: PublishSubjectKind; id: number }, featureKey: string) =>
      isPublishedForAffiliate(readyRows, subject, featureKey),
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
