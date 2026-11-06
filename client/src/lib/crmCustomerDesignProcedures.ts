import { trpc } from "@/lib/trpc";
import { serverLinkedDesigns, type DesignLinkKind } from "@shared/crmCustomerDesigns";

export type CrmCustomerDesignRow = {
  /** kitchen_designs.id */
  id: number;
  name: string;
  thumbnailUrl: string | null;
  assistLabel: string | null;
  updatedAt: string | Date | null;
  /** How the server proved this design belongs to the customer. */
  linkKind?: DesignLinkKind;
  /** crm_deal_designs.id for a deal link; null for a contractor folder link. */
  linkId?: number | null;
  /**
   * The store the design itself lives in. The Designer link is built from this
   * (main's #274), never from the store whose CRM is open.
   */
  affiliateSlug?: string | null;
};

export type CrmCustomerDesignsResult = {
  schemaReady: boolean;
  /** crm_deals.id the list was filtered by. Null means the server had no deal. */
  dealId: number | null;
  designs: CrmCustomerDesignRow[];
};

/**
 * `crm.customerDesigns` ships with the backend patch
 * docs/patches/cabinet-backend-crm-customer-designs.patch. It filters by
 * crm_deals.id / crm_deal_designs on the server. Cast until AppRouter lists it,
 * the same way the image-generation procedures are wired.
 */
export function useCrmCustomerDesigns(dealId: number | null | undefined) {
  const procedures = trpc as unknown as {
    crm: {
      customerDesigns: {
        useQuery: (
          input: { dealId: number },
          options?: { enabled?: boolean; retry?: boolean },
        ) => {
          data?: CrmCustomerDesignsResult;
          isLoading: boolean;
          error: { message: string } | null;
          refetch: () => Promise<unknown> | void;
        };
      };
    };
  };
  const query = procedures.crm.customerDesigns.useQuery(
    { dealId: dealId ?? 0 },
    { enabled: dealId != null && dealId > 0, retry: false },
  );

  // The server owns the link decision. A row without a proven `linkKind` is
  // dropped here too, so an older backend that still lists every design on the
  // account cannot repopulate the customer view.
  const designs = serverLinkedDesigns(query.data?.designs ?? []);

  return {
    ...query,
    designs,
    schemaReady: query.data?.schemaReady ?? false,
    // `false` when this build has not shipped the backend procedure yet, so the
    // drawer can say so instead of looking empty for the wrong reason.
    unavailable: Boolean(query.error) && !query.isLoading,
  };
}
