import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  search: "",
  calls: [] as Array<{ namespace: string; procedure: string; input?: Record<string, unknown> }>,
}));

const byCode = {
  "3015": [
    { id: 1, masterCode: "PR3015", description: "Wall Plate Rack Cabinet", category: "Wall", subCategory: "Plate Rack", width: "30", height: "15", depth: "12" },
    { id: 2, masterCode: "W3015", description: "Wall Cabinet", category: "Wall", subCategory: "Wall", width: "30", height: "15", depth: "12" },
    { id: 3, masterCode: "DN-WRC3015", description: "Wall Wine Rack Cabinet", category: "Wall", subCategory: "Wine Rack", width: "30", height: "15", depth: "12" },
  ],
  "wine rack": [
    { id: 3, masterCode: "DN-WRC3015", description: "Wall Wine Rack Cabinet", category: "Wall", subCategory: "Wine Rack", width: "30", height: "15", depth: "12" },
    { id: 4, masterCode: "LWR3015", description: "Lattice Wine Rack", category: "Wall", subCategory: "Wine Rack", width: "30", height: "15", depth: "12" },
  ],
};

vi.mock("@/lib/trpc", () => {
  const trpc = new Proxy({
    useUtils: () => new Proxy({}, { get: () => ({ invalidate: vi.fn() }) }),
  }, {
    get(target, namespace: string) {
      if (namespace === "useUtils") return target.useUtils;
      return new Proxy({}, {
        get(_procedureTarget, procedure: string) {
          return {
            useQuery: (input?: Record<string, unknown>) => {
              state.calls.push({ namespace, procedure, input });
              if (namespace === "cabinets" && procedure === "list") {
                const term = String(input?.search ?? "").toLowerCase();
                const items = byCode[term as keyof typeof byCode] ?? [];
                return { data: { items, total: items.length }, isLoading: false };
              }
              if (namespace === "cabinets" && procedure === "listForStyle") {
                const term = String(input?.search ?? "");
                const items = byCode[term as keyof typeof byCode] ?? [];
                return { data: { items, total: items.length, categoryCounts: {} }, isLoading: false };
              }
              if (namespace === "doorStyles" && procedure === "list") return { data: [], isLoading: false };
              if (namespace === "distributors" && procedure === "list") return { data: [], isLoading: false };
              return { data: undefined, isLoading: false };
            },
            useMutation: () => ({ mutate: vi.fn(), isPending: false }),
          };
        },
      });
    },
  });
  return { trpc };
});

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ lang: "en", t: (key: string) => key }),
}));
vi.mock("@/hooks/useSeo", () => ({ useSeo: vi.fn() }));
vi.mock("wouter", () => ({
  Link: ({ children, href }: { children?: React.ReactNode; href?: string }) => createElement("a", { href }, children),
  useSearch: () => state.search,
  useLocation: () => ["/catalog", vi.fn()],
}));

import Catalog from "./Catalog";

function markup() {
  return renderToStaticMarkup(createElement(Catalog));
}

function callsTo(procedure: string) {
  return state.calls.filter((call) => call.namespace === "cabinets" && call.procedure === procedure);
}

describe("catalog search", () => {
  beforeEach(() => {
    state.search = "";
    state.calls = [];
  });

  it("shows partial SKU matches from the public catalog when no door style is selected", () => {
    state.search = "?q=3015";
    const html = markup();
    expect(html).toContain("PR3015");
    expect(html).toContain("W3015");
    expect(html).toContain("DN-WRC3015");
    expect(html).not.toContain("cat_choose_style_title");
    const list = callsTo("list").find((call) => call.input?.search === "3015");
    expect(list?.input).toMatchObject({ search: "3015", limit: 48, offset: 0 });
    expect(callsTo("listForStyle").every((call) => call.input?.styleId === 0)).toBe(true);
  });

  it("shows a multi-word description match such as wine rack without a door style", () => {
    state.search = "?q=wine+rack";
    const html = markup();
    expect(html).toContain("Wall Wine Rack Cabinet");
    expect(html).toContain("Lattice Wine Rack");
    expect(html).not.toContain("cat_choose_style_title");
    expect(callsTo("list").some((call) => call.input?.search === "Wine Rack")).toBe(true);
  });

  it("keeps a selected door style on the style catalog, including the same phrase", () => {
    state.search = "?style=390001&q=wine+rack";
    const html = markup();
    expect(html).toContain("Wall Wine Rack Cabinet");
    expect(html).toContain("Lattice Wine Rack");
    expect(callsTo("listForStyle").some((call) => call.input?.styleId === 390001 && call.input?.search === "wine rack")).toBe(true);
  });

  it("still asks for a door style when a category is open and nothing was typed", () => {
    state.search = "?category=Base";
    const html = markup();
    expect(html).toContain("cat_choose_style_title");
    expect(html).not.toContain("PR3015");
  });
});
