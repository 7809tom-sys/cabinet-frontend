import { trpc } from "@/lib/trpc";
import type { LegalPagePresentation, LegalSheet } from "@shared/legalPages";
import type { SalesRepCommissionSettings } from "@shared/salesRepCommission";

type ProcedureError = { message: string };

export type ApprovedRep = { userId: number; name: string; email: string | null; state: string | null };

export type RepApplication = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  state: string | null;
  businessName: string | null;
  status: "pending" | "approved" | "rejected";
  userId: number | null;
  createdAt: string;
};

export type LegalSlotView = {
  slug: string;
  title: string;
  publicPath: string;
  publishedVersion: number;
  versions: {
    version: number;
    source: string;
    bodyText: string | null;
    fileName: string | null;
    uploadedAt: string;
    uploadedBy: string;
    hasSheet: boolean;
  }[];
  presentation: LegalPagePresentation;
  schemaMissing?: boolean;
};

export type AffiliateSaleCommission = {
  id: number;
  repName: string;
  repUserId: number;
  affiliateName: string;
  kind: "flat" | "residual";
  amountCents: number;
  flatFeeCents: number;
  residualRateBps: number;
  residualBase: string;
  status: string;
  earnedAt: string;
  flagReason?: string | null;
};

type Query<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: ProcedureError | null;
  refetch: () => Promise<unknown> | void;
};

// Cast until AppRouter includes these procedures. The cabinet-backend branch
// cursor/affiliate-membership-checkout-b5d7 adds them. A missing procedure
// answers NOT_FOUND; screens fall back to the seeded copy.
export function useMembershipProgramProcedures() {
  return trpc as unknown as {
    useUtils: () => {
      legalPages: { list: { invalidate: () => Promise<void> }; published: { invalidate: () => Promise<void> } };
      salesRepProgram: {
        listApplications: { invalidate: () => Promise<void> };
        commissionSettings: { invalidate: () => Promise<void> };
        listAffiliateSaleCommissions: { invalidate: () => Promise<void> };
      };
    };
    legalPages: {
      published: {
        useQuery: (
          input: { slug: string },
          options?: { retry?: boolean },
        ) => Query<LegalPagePresentation & { schemaMissing?: boolean; fileDataUrl?: string | null }>;
      };
      list: {
        useQuery: (input?: undefined, options?: { retry?: boolean }) => Query<{ slots: LegalSlotView[]; schemaMissing: boolean }>;
      };
      publish: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: ProcedureError) => void }) => {
          mutate: (input: {
            slug: string;
            bodyText?: string | null;
            fileName?: string | null;
            mimeType?: string | null;
            fileBase64?: string | null;
            sheet?: LegalSheet | null;
          }) => void;
          isPending: boolean;
        };
      };
      rollback: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: ProcedureError) => void }) => {
          mutate: (input: { slug: string; version: number }) => void;
          isPending: boolean;
        };
      };
      addSlot: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: ProcedureError) => void }) => {
          mutate: (input: { title: string; publicPath: string }) => void;
          isPending: boolean;
        };
      };
    };
    salesRepProgram: {
      approvedReps: {
        useQuery: (input?: undefined, options?: { retry?: boolean }) => Query<ApprovedRep[]>;
      };
      listApplications: {
        useQuery: (input?: undefined, options?: { retry?: boolean }) => Query<{ rows: RepApplication[]; schemaMissing: boolean }>;
      };
      apply: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: ProcedureError) => void }) => {
          mutate: (input: {
            fullName: string;
            email: string;
            phone?: string;
            state?: string;
            businessName?: string;
            agreementVersion: string;
            agreementAcceptedAt: string;
          }) => void;
          isPending: boolean;
        };
      };
      setApplicationStatus: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: ProcedureError) => void }) => {
          mutate: (input: { id: number; status: "approved" | "rejected" }) => void;
          isPending: boolean;
        };
      };
      assignRep: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: ProcedureError) => void }) => {
          mutate: (input: { affiliateId: number; salesRepUserId: number | null }) => void;
          isPending: boolean;
        };
      };
      commissionSettings: {
        useQuery: (input?: undefined, options?: { retry?: boolean }) => Query<SalesRepCommissionSettings & { schemaMissing?: boolean }>;
      };
      saveCommissionSettings: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: ProcedureError) => void }) => {
          mutate: (input: SalesRepCommissionSettings) => void;
          isPending: boolean;
        };
      };
      listAffiliateSaleCommissions: {
        useQuery: (input?: undefined, options?: { retry?: boolean }) => Query<AffiliateSaleCommission[]>;
      };
    };
    affiliateMembership: {
      startCheckout: {
        useMutation: (options?: {
          onSuccess?: (result: { url: string }) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutate: (input: {
            plan: "annual" | "monthly";
            salesRepUserId?: number | null;
            operatorNoticeAcceptedAt: string;
            agreementVersion: string;
            agreementAcceptedAt: string;
          }) => void;
          isPending: boolean;
        };
      };
    };
  };
}
