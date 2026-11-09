// @vitest-environment jsdom
/**
 * After a designer crash the last good draft stays under the draft key and the
 * crashed state is saved apart, as a marker. The next mount asks before it
 * restores anything, so a draft that crashes the designer cannot crash it again
 * on its own.
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
  const mutationResult = {
    mutate: () => {},
    mutateAsync: async () => ({}),
    isPending: false,
    reset: () => {},
    error: null,
  };
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
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: async () => ({}),
      getSession: async () => ({ data: { session: null } }),
    },
  },
}));
// The real viewer needs WebGL. jsdom only needs to prove the host wires the
// toggle, so the stand-in renders the same labelled control the real one does.
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    InteractiveRoom3D: ({
      immersive,
      onToggleImmersive,
    }: {
      immersive?: boolean;
      onToggleImmersive?: () => void;
    }) => (
      <div data-testid="mock-3d">
        {onToggleImmersive && (
          <button
            type="button"
            data-testid="three-d-immersive-toggle"
            aria-pressed={Boolean(immersive)}
            aria-label={immersive ? "Exit fullscreen" : "Fullscreen view"}
            onClick={onToggleImmersive}
          >
            {immersive ? "Exit fullscreen" : null}
          </button>
        )}
      </div>
    ),
  };
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;

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

const DRAFT_KEY = "cabinet-dealz:designer-draft:v2:owner:admin@cabinetdealz.test";

/** One placed base cabinet: enough for the Designer to render its workspace. */
const baseCabinet = {
  uid: "base-1",
  cabinetId: 12,
  masterCode: "B24",
  description: '24" Base Cabinet',
  category: "Base Cabinets",
  subCategory: "Base Cabinets",
  placement: "base",
  x: 40,
  y: 0,
  width: 24,
  depth: 24,
  height: 34.5,
  wallId: "back",
  wallOffset: 64,
  rotation: 0,
  mountHeightIn: 0,
};

function seedDraft() {
  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ v: 2, originScope: "owner", savedAt: Date.now(), placed: [baseCabinet] }),
  );
}

async function renderDesigner(width = 1500) {
  seedDraft();
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

// A signed-in Designer files its draft (and its crash copy) under the account.
const ACCOUNT_DRAFT_KEY = "cabinet-dealz:designer-draft:v2:owner:acct-1";
const CRASH_KEY = `${ACCOUNT_DRAFT_KEY}::crashed`;

function seedCrashMarker() {
  window.localStorage.setItem(CRASH_KEY, JSON.stringify({ v: 1, at: Date.now(), snapshot: { placed: [] } }));
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
});

afterEach(() => {
  cleanup();
});

describe("designer crash restore prompt", () => {
  it("restores nothing until asked, then Restore previous opens the last good draft", { timeout: 120_000 }, async () => {
    seedCrashMarker();
    await renderDesigner();
    const lastGood = window.localStorage.getItem(DRAFT_KEY);
    expect(lastGood).toContain("base-1");
    window.localStorage.setItem(ACCOUNT_DRAFT_KEY, lastGood!);
    expect(screen.getByTestId("designer-crash-restore")).toBeTruthy();
    // No autosave while the prompt is open: the last good draft is untouched.
    await wait(600);
    expect(window.localStorage.getItem(ACCOUNT_DRAFT_KEY)).toBe(lastGood);

    fireEvent.click(screen.getByRole("button", { name: "Restore previous" }));
    await act(async () => {});
    expect(screen.queryByTestId("designer-crash-restore")).toBeNull();
    expect(window.localStorage.getItem(CRASH_KEY)).toBeNull();
    await wait(600);
    const saved = JSON.parse(window.localStorage.getItem(ACCOUNT_DRAFT_KEY)!);
    expect(saved.placed.map((cabinet: { uid: string }) => cabinet.uid)).toEqual(["base-1"]);
  });

  it("Start fresh drops the draft and opens an empty design", { timeout: 120_000 }, async () => {
    seedCrashMarker();
    window.localStorage.setItem(ACCOUNT_DRAFT_KEY, JSON.stringify({ v: 2, originScope: "owner", savedAt: Date.now(), placed: [baseCabinet] }));
    await renderDesigner();
    fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));
    await act(async () => {});
    expect(screen.queryByTestId("designer-crash-restore")).toBeNull();
    expect(window.localStorage.getItem(CRASH_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACCOUNT_DRAFT_KEY)).toBeNull();
    await wait(600);
    expect(window.localStorage.getItem(ACCOUNT_DRAFT_KEY)).toBeNull();
  });

  it("restores as before when there was no crash", { timeout: 120_000 }, async () => {
    await renderDesigner();
    expect(screen.queryByTestId("designer-crash-restore")).toBeNull();
  });
});
