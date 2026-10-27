import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function usePortalScopes(input: { distributorId?: number; approvedVendorLineId?: number }) {
  const query = trpc.vendorFulfillment.scopes.useQuery({
    distributorId: input.distributorId,
    approvedVendorLineId: input.approvedVendorLineId,
  });
  const [picked, setPicked] = useState<string | null>(null);
  const scopes = query.data ?? [];
  const scope = picked && scopes.some((item) => item.scope === picked) ? picked : scopes[0]?.scope ?? null;
  return { scopes, scope, setScope: setPicked, isLoading: query.isLoading, error: query.error };
}
