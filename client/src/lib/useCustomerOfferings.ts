import { trpc } from "@/lib/trpc";
import {
  CUSTOMER_OFFERINGS_FIELD,
  CUSTOMER_OFFERINGS_PAGE_KEY,
  customerOfferingsAreVisible,
} from "@shared/customerOfferings";

type PageContentClient = {
  useUtils: () => {
    pageContent: {
      getPage: { invalidate: (input: { pageKey: string }) => void };
      getAll: { invalidate: () => void };
    };
  };
  pageContent: {
    getPage: {
      useQuery: (
        input: { pageKey: string },
        options?: { staleTime?: number; refetchOnWindowFocus?: boolean; refetchInterval?: number },
      ) => { data?: Record<string, string> | null; isLoading: boolean; isError: boolean };
    };
    upsertField: {
      useMutation: (options?: { onSuccess?: () => void }) => {
        mutate: (input: { pageKey: string; field: string; value: string }) => void;
        isPending: boolean;
      };
    };
  };
};

/**
 * The yes/no lives in the existing page_content table
 * (pageContent.getPage / upsertField), which customers can read and an admin can save.
 * site_settings has no column for this switch. Missing value stays yes.
 * The query refreshes on focus and every few seconds so a change shows up without a redeploy.
 */
export function useCustomerOfferings() {
  const client = trpc as unknown as PageContentClient;
  const utils = client.useUtils();
  const query = client.pageContent.getPage.useQuery(
    { pageKey: CUSTOMER_OFFERINGS_PAGE_KEY },
    { staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 5_000 },
  );
  const save = client.pageContent.upsertField.useMutation({
    onSuccess: () => {
      void utils.pageContent.getPage.invalidate({ pageKey: CUSTOMER_OFFERINGS_PAGE_KEY });
      void utils.pageContent.getAll.invalidate();
    },
  });
  const visible = query.isError ? true : customerOfferingsAreVisible(query.data?.[CUSTOMER_OFFERINGS_FIELD]);
  return {
    visible,
    loading: query.isLoading && query.data == null,
    saving: save.isPending,
    setVisible: (next: boolean) => save.mutate({
      pageKey: CUSTOMER_OFFERINGS_PAGE_KEY,
      field: CUSTOMER_OFFERINGS_FIELD,
      value: next ? "yes" : "no",
    }),
  };
}
