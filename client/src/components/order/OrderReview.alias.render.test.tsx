import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutate } = vi.hoisted(() => ({ mutate: { mutate: vi.fn(), isPending: false } }));

vi.mock("@/lib/trpc", () => ({
  trpc: (() => {
    const useQuery = (data: unknown) => () => ({ data, isLoading: false });
    return {
    cabinets: { list: { useQuery: useQuery({ items: [] }) } },
    affiliates: { byCode: { useQuery: useQuery(null) } },
    location: {
      pickupOptions: { useQuery: useQuery({ options: [] }) },
      getTaxRate: { useQuery: useQuery(null) },
    },
    freight: {
      estimate: { useQuery: useQuery(null) },
    },
    orders: {
      touchUpKit: { useQuery: useQuery(null) },
      stylesForCabinets: { useQuery: useQuery([{ styleId: 330007, name: "Hickory Shaker", doorStyle: "Shaker", finish: "Hickory", color: null, coversAll: true, coverage: 1 }]) },
      recommendAddOns: { useQuery: useQuery(null) },
      priceLines: { useQuery: useQuery({ prices: [{ cabinetId: 9390025, unitPrice: 197.63, myCost: null }] }) },
      saveAlias: { useMutation: () => mutate },
      createRequest: { useMutation: () => mutate },
      confirm: { useMutation: () => mutate },
    },
    pantry: { listBottoms: { useQuery: useQuery([]) } },
    storefront: { brandingForSlug: { useQuery: useQuery({ styleNames: { 330007: "Reeves Vitest Checkout Alias" } }) } },
    installationEstimates: { forOrderConfirmation: { useQuery: useQuery(null) } },
    useUtils: () => ({ pantry: { pairForBottom: { fetch: vi.fn() } }, orders: { myRequests: { invalidate: vi.fn() } } }),
    };
  })(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@/hooks/useReferral", () => ({ readAffiliateSlug: () => "reaves-way-cabinet-shop", readReferralCode: () => "REAVESWAYCABINETSHOP", setReferralCode: vi.fn() }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OrderReview } from "./OrderReview";

describe("OrderReview affiliate alias rendering", () => {
  beforeEach(() => mutate.mutate.mockClear());

  it("renders the affiliate alias in the checkout door-style header and total summary", () => {
    const html = renderToStaticMarkup(
      <OrderReview
        lines={[{ rawCode: "CBLPN2", normalized: "CBLPN2", qty: 1, cabinetId: 9390025, masterCode: "CBLPN2", description: "Corbel", matched: true, confidence: "exact" }]}
        source="manual"
        initialStyleId={330007}
        initialTier="homeowner"
        onLinesChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(html).toContain("Reeves Vitest Checkout Alias");
    expect(html).not.toContain("Hickory Shaker · homeowner");
  });
});
