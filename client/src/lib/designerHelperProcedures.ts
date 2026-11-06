import { trpc } from "@/lib/trpc";
import type {
  HelperNotifyPlan,
  HelperQueueEntry,
  HelperRequest,
} from "@shared/designerHelperQueue";

/**
 * The `designerHelper` procedures ship in the backend patch
 * (`docs/patches/cabinet-backend-designer-helper-queue.patch`), so the generated
 * `AppRouter` type in this checkout does not carry them yet. Cast the client,
 * the same way `contractorPortalProcedures` and `imageGenerationProcedures` do,
 * until that patch is applied and the types regenerate.
 */

type QueryOptions = { enabled?: boolean; retry?: boolean; refetchInterval?: number | false };
type MutationError = { message: string };
type MutationResult = { isPending: boolean; error: { message: string } | null };

type MutationOptions = {
  onSuccess?: (result: never) => void;
  onError?: (error: MutationError) => void;
};

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  isFetching?: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown> | void;
};

export type HelperSignState = {
  available: boolean;
  signedOnAt: string | null;
  designerName: string;
  email: string | null;
  queuePosition: number | null;
  queue: HelperQueueEntry[];
  acceptedCount: number;
};

export type HelperRequestResult = {
  request: HelperRequest;
  sharePath: string;
  designPath: string;
  mailerConfigured: boolean;
  notification: HelperNotifyPlan;
};

export type HelperNoticeList = {
  /** The full request record, so the admin pop-up can show every field. */
  request: HelperRequest;
  /** Opens the customer's saved design in the Designer's assisted mode. */
  designPath: string;
  /** Records who joined and when, then opens that design. */
  joinPath: string;
  customerSharePath: string | null;
};

export type HelperJoinResult = {
  requestId: number;
  designId: number | null;
  designPath: string;
  joinedAt: string;
  joinedByName: string;
};

export type HelperRequestInput = {
  designId: number;
  helpNote: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  affiliateSlug: string | null;
};

export function useDesignerHelperProcedures() {
  return trpc as unknown as {
    designerHelper: {
      mailerStatus: {
        useQuery: (input?: undefined, options?: QueryOptions) => QueryResult<{ mailerConfigured: boolean }>;
      };
      mySign: {
        useQuery: (input?: undefined, options?: QueryOptions) => QueryResult<HelperSignState>;
      };
      setSign: {
        useMutation: (options?: {
          onSuccess?: (result: HelperSignState) => void;
          onError?: (error: MutationError) => void;
        }) => { mutate: (input: { available: boolean }) => void; isPending: boolean };
      };
      myNotices: {
        useQuery: (input?: undefined, options?: QueryOptions) => QueryResult<HelperNoticeList[] | HelperNoticeList>;
      };
      adminInbox: {
        useQuery: (input?: undefined, options?: QueryOptions) => QueryResult<HelperNoticeList[] | HelperNoticeList>;
      };
      request: {
        useMutation: (options?: {
          onSuccess?: (result: HelperRequestResult) => void;
          onError?: (error: MutationError) => void;
        }) => { mutate: (input: HelperRequestInput) => void; mutateAsync: (input: HelperRequestInput) => Promise<HelperRequestResult>; isPending: boolean; error: { message: string } | null };
      };
      accept: {
        useMutation: (options?: {
          onSuccess?: (result: HelperRequestResult) => void;
          onError?: (error: MutationError) => void;
        }) => { mutate: (input: { requestId: number }) => void; isPending: boolean; error: { message: string } | null };
      };
      join: {
        useMutation: (options?: {
          onSuccess?: (result: HelperJoinResult) => void;
          onError?: (error: MutationError) => void;
        }) => { mutate: (input: { requestId: number }) => void; isPending: boolean; error: { message: string } | null };
      };
      close: {
        useMutation: (options?: MutationOptions) => { mutate: (input: { requestId: number }) => void; isPending: boolean; error: { message: string } | null };
      };
    };
  };
}

/** `myNotices`/`adminInbox` answer with a list; older shims answer with one. */
export function helperNoticeRows(data: HelperNoticeList[] | HelperNoticeList | undefined): HelperNoticeList[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}
