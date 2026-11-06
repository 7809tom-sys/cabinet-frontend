// @vitest-environment jsdom
/**
 * "More tools" is the sheet the phone and tablet workspaces fold every
 * secondary Designer action into. These tests open the real sheet and read the
 * rendered rows, so the order a person sees is the order that ships.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DesignTool from "./DesignTool";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const { router } = vi.hoisted(() => {
  const queryResult = {
    data: undefined,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: async () => ({}),
  };
  const mutationResult = { mutate: () => {}, mutateAsync: async () => ({}), isPending: false, reset: () => {}, error: null };
  const hooks: Record<string, unknown> = {
    useQuery: () => queryResult,
    useMutation: () => mutationResult,
    useInfiniteQuery: () => ({ ...queryResult, fetchNextPage: async () => {} }),
    useSuspenseQuery: () => queryResult,
    setData: async () => ({}),
    invalidate: async () => ({}),
  };
  const proxy: any = new Proxy(function noop() {}, {
    get(_t, prop: string) {
      if (prop in hooks) return hooks[prop];
      return proxy;
    },
    apply() {
      return proxy;
    },
  });
  return { router: proxy };
});

vi.mock("@/lib/trpc", () => ({ trpc: router }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin", email: "admin@cabinetdealz.test", name: "Admin" },
    isAuthenticated: true,
    loading: false,
    logout: async () => {},
  }),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signOut: async () => ({}), getSession: async () => ({ data: { session: null } }) } } }));
// WebGL is unavailable under jsdom; the 3D canvas is not part of this contract.
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, InteractiveRoom3D: () => <div data-testid="mock-3d" /> };
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

function stubViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
}

async function renderDesigner(width: number) {
  stubViewport(width);
  const view = render(
    <PreferredProductsProvider>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <CartProvider>
            <DesignTool />
          </CartProvider>
        </LanguageProvider>
      </ThemeProvider>
    </PreferredProductsProvider>,
  );
  await act(async () => {});
  return view;
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
});

afterEach(cleanup);

describe("Designer More tools sheet order", () => {
  it("renders Start New Design as the first row in the sheet", async () => {
    await renderDesigner(375);

    fireEvent.click(screen.getByTitle("More options"));
    await act(async () => {});

    const sheet = await screen.findByRole("dialog");
    const row = sheet.querySelector('[data-testid="more-sheet-start-new-design"]');
    expect(row).toBeTruthy();

    // Every interactive row the sheet renders, in document order.
    const rows = Array.from(sheet.querySelectorAll("button, a")).filter((element) =>
      element.textContent?.trim(),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toBe(row!.querySelector("button") ?? row);
    expect(rows[0].textContent).toContain("Start new design");
  });

  it("keeps Start New Design ahead of the sections it used to sit below", async () => {
    await renderDesigner(375);

    fireEvent.click(screen.getByTitle("More options"));
    await act(async () => {});

    const sheet = await screen.findByRole("dialog");
    const text = sheet.textContent ?? "";
    const startNewAt = text.indexOf("Start new design");

    expect(startNewAt).toBeGreaterThan(-1);
    for (const later of ["Appliance color", "Interactive 3D Preview", "Import Existing Design", "Handles & knobs"]) {
      const at = text.indexOf(later);
      expect(at, `${later} should still be listed in the sheet`).toBeGreaterThan(-1);
      expect(at, `Start New Design must come before ${later}`).toBeGreaterThan(startNewAt);
    }
  });
});
