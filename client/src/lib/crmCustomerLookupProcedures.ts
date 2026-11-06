import { trpc } from "@/lib/trpc";
import type { DesignLinkKind } from "@shared/crmCustomerDesigns";

export type LookupDesign = {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  assistLabel: string | null;
  updatedAt: string | Date | null;
  linkKind: DesignLinkKind;
  linkId: number | null;
  designUrl: string;
};

export type CustomerLookupHit = {
  ok: true;
  identifier: string;
  dealId: number;
  customerName: string | null;
  contactEmail: string | null;
  affiliateId: number | null;
  designs: LookupDesign[];
  outcome: "none" | "one" | "several";
  /** Set when there is exactly one design, so the caller can open it. */
  openUrl: string | null;
};

export type CustomerLookupMiss = {
  ok: false;
  reason: "not-an-identifier" | "not-found";
  identifier: string;
  dealId: number | null;
};

export type CustomerLookupResult = CustomerLookupHit | CustomerLookupMiss;

/**
 * `crm.customerLookup` ships with the backend patch
 * docs/patches/cabinet-backend-crm-customer-designs.patch. Cast until AppRouter
 * lists it, the same way crm.customerDesigns and imageGenerations are wired.
 */
export function useCustomerLookup() {
  const procedures = trpc as unknown as {
    crm: {
      customerLookup: {
        useQuery: (
          input: { identifier: string },
          options?: { enabled?: boolean; retry?: boolean; refetchOnWindowFocus?: boolean },
        ) => {
          data?: CustomerLookupResult;
          isFetching: boolean;
          error: { message: string } | null;
        };
      };
    };
  };
  return procedures.crm.customerLookup;
}

/**
 * The drawer's "customer #" for a hit. The identifier staff typed is shown as the
 * label, the internal deal id is only used for the request.
 */
export function lookupHeading(result: CustomerLookupResult): string {
  return result.ok ? (result.customerName?.trim() || `Customer #${result.dealId}`) : `Customer ${result.identifier}`;
}
