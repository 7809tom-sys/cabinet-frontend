import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const duplicateCabinet = {
  id: 9390110,
  masterCode: "W-1230",
  description: '12" Single Door Wall Cabinet with 2 Adjustable Shelves',
  category: "Wall",
  subCategory: "Standard Wall",
  width: "12",
  height: "30",
  depth: "12",
  catalogImageUrl: null,
  showInCatalog: true,
  showInDesigner: true,
  showIn2020: true,
  isActive: true,
};

const exactDuplicateStyle = {
  styleId: 330005,
  styleCode: "FS",
  name: "Fresh Sage",
  doorStyle: "Shaker",
  finish: "Fresh Sage",
  color: "#9AAE97",
  doorSampleImageUrl: null,
  roomSceneImageUrl: null,
  thumbnailImageUrl: null,
  listPrice: "753.39",
  adjustedListPrice: "372.93",
  wholesalePrice: null,
  contractorPrice: null,
  homeownerPrice: "372.93",
  yourCost: "220.00",
  affiliateCost: "237.32",
  platformSku: "FS-W1230",
  leadTimeDays: 7,
  distributorId: 210001,
};

const state = vi.hoisted(() => ({
  currentUser: null as { role: string; pricingTier?: string } | null,
  mutation: {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  },
}));

vi.mock("@/lib/trpc", () => {
  const queryData = (namespace: string, procedure: string, input?: Record<string, unknown>) => {
    if (namespace === "cabinetCategories" && procedure === "list") return [];
    if (namespace === "cabinets" && procedure === "byId") {
      return input?.id === 9390110 ? duplicateCabinet : null;
    }
    if (namespace === "cabinets" && procedure === "byCode") return null;
    if (namespace === "pricing" && procedure === "stylesForCabinet") {
      // Exact duplicate-SKU detail route must retain this record, not the
      // ambiguous code-only fallback.
      return input?.cabinetId === 9390110 ? [
        state.currentUser?.role === "admin"
          ? { ...exactDuplicateStyle, affiliateCost: null }
          : { ...exactDuplicateStyle, yourCost: null },
      ] : [];
    }
    if (namespace === "promotions" && procedure === "activeForStorefront") return [];
    if (namespace === "siteSettings" && procedure === "getPublicSettings") return { pricingVisibility: "public" };
    if (namespace === "genericCabinets" && procedure === "distributorCoverage") return [];
    if (namespace === "cabinetOverrides" && procedure === "forCabinet") return [];
    if (namespace === "cabinets" && procedure === "listForStyle") return [];
    if (namespace === "cabinet3dPreview" && procedure === "get") return null;
    return [];
  };
  const trpc = new Proxy({
    useUtils: () => new Proxy({}, { get: () => ({ invalidate: vi.fn() }) }),
  }, {
    get(target, namespace: string) {
      if (namespace === "useUtils") return target.useUtils;
      return new Proxy({}, {
        get: (_procedureTarget, procedure: string) => ({
          useQuery: (input?: Record<string, unknown>) => ({
            data: queryData(namespace, procedure, input),
            isLoading: false,
          }),
          useMutation: () => state.mutation,
        }),
      });
    },
  });
  return { trpc };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: state.currentUser }) }));
vi.mock("@/contexts/CartContext", () => ({
  useCart: () => ({ addItem: () => ({ ok: true }), clear: vi.fn(), lockedDistributorId: null, lockedStyleLabel: null }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ lang: "en", t: (key: string) => key }),
}));
vi.mock("@/hooks/useSeo", () => ({ useSeo: vi.fn() }));
vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => createElement("a", null, children),
  useSearch: () => "?style=330005&cabinetId=9390110",
  useLocation: () => ["/cabinet/W-12-30", vi.fn()],
}));

import CabinetDetail from "./CabinetDetail";

describe("duplicate-SKU CabinetDetail route private pricing", () => {
  beforeEach(() => {
    state.mutation.mutate.mockReset();
    state.mutation.mutateAsync.mockReset();
  });

  it("renders Affiliate Cost, Sells At, and adjusted-margin from the exact affiliate detail route", () => {
    state.currentUser = { role: "user", pricingTier: "homeowner" };
    const markup = renderToStaticMarkup(createElement(CabinetDetail, { masterCode: "W-12-30" }));

    expect(markup).toContain('12&quot; Single Door Wall Cabinet with 2 Adjustable Shelves');
    expect(markup).toContain("Affiliate view · not shown to customers");
    expect(markup).toContain("Affiliate Cost");
    expect(markup).toContain("$237.32");
    expect(markup).toContain("Sells At (Homeowner)");
    expect(markup).toContain("$135.61 (36.4%)");
    expect(markup).not.toContain("My Cost");
  });

  it("renders Administration My Cost and its raw-cost margin on the same exact detail route", () => {
    state.currentUser = { role: "admin", pricingTier: "homeowner" };
    const markup = renderToStaticMarkup(createElement(CabinetDetail, { masterCode: "W-12-30" }));

    expect(markup).toContain("Administration view · not shown to customers");
    expect(markup).toContain("My Cost");
    expect(markup).toContain("$220.00");
    expect(markup).toContain("Sells At (Homeowner)");
    expect(markup).toContain("$152.93 (41%)");
    expect(markup).not.toContain("Affiliate Cost");
  });
});
