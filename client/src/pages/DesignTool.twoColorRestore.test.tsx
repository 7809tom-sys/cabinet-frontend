// @vitest-environment jsdom
/**
 * Issue #352 on the real Designer page: a draft autosaved while the Color 2 slot
 * was highlighted must come back with the kitchen on Color 1. The brush may
 * stay on Color 2, but the plan that is saved and quoted is Color 1's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import DesignTool from "./DesignTool";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const { router, savedPlan } = vi.hoisted(() => {
  const queryResult = {
    data: undefined, isLoading: false, isPending: false, isSuccess: false,
    isError: false, isFetching: false, error: null, refetch: async () => ({}),
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
    apply() { return proxy; },
  });
  return { router: proxy, savedPlan: { styleId: undefined as number | null | undefined } };
});

vi.mock("@/lib/trpc", () => ({ trpc: router }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin", email: "owner@cabinetdealz.test", name: "Owner" },
    isAuthenticated: true, loading: false, logout: async () => {},
  }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: async () => ({}), getSession: async () => ({ data: { session: null } }) } },
}));
vi.mock("@/components/design/DesignActions", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    DesignActions: (props: { styleId: number | null; styleName: string | null }) => {
      savedPlan.styleId = props.styleId;
      return <div data-testid="mock-design-actions" />;
    },
  };
});
// The real viewer needs WebGL; the saved plan and the draft are what these tests read.
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, InteractiveRoom3D: () => <div data-testid="mock-3d" /> };
});

if (!(HTMLElement.prototype as any).setPointerCapture) {
  (HTMLElement.prototype as any).setPointerCapture = () => {};
  (HTMLElement.prototype as any).releasePointerCapture = () => {};
  (HTMLElement.prototype as any).hasPointerCapture = () => false;
}
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

function stubViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
  }) as unknown as typeof window.matchMedia;
}

const DRAFT_KEY = "cabinet-dealz:designer-draft:v2:owner:acct-1";
const COLOR_ONE = 390016;
const COLOR_TWO = 390018;

function cabinet(uid: string, masterCode: string, placement: "base" | "wall", x: number, styleId: number | null) {
  return {
    uid, cabinetId: 1, masterCode, description: masterCode,
    category: placement === "base" ? "Base Cabinets" : "Wall Cabinets",
    subCategory: placement === "base" ? "Base Cabinets" : "Wall Cabinets", placement,
    x, y: 0, width: 24, depth: placement === "base" ? 24 : 12, height: placement === "base" ? 34.5 : 30,
    wallId: "top", wallOffset: x, rotation: 0, mountBottom: placement === "base" ? 0 : 54, styleId,
  };
}

/** Uppers carry Auto Design's Color 1 stamp; the bases inherit the design finish. */
const KITCHEN = [
  cabinet("w1", "W2430", "wall", 0, COLOR_ONE),
  cabinet("w2", "W2430", "wall", 24, COLOR_ONE),
  cabinet("b1", "B24", "base", 0, null),
  cabinet("b2", "B24", "base", 24, null),
];

async function renderDesigner(draft: Record<string, unknown>) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
    v: 2, originScope: "owner", savedAt: Date.now(), roomType: "kitchen",
    room: { width: 144, depth: 120, ceilingHeight: 96 },
    placed: KITCHEN, openings: [], sinks: [], furniture: [], potFillers: [], ponyWalls: [], annotations: [],
    ...draft,
  }));
  stubViewport(1500);
  render(
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
}

async function autosaved(): Promise<{ styleId?: number; styleA?: number; styleB?: number; activeSlot?: string; placed?: Array<{ uid: string; styleId: number | null }> }> {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
  return JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "{}");
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
  savedPlan.styleId = undefined;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("#352: a draft saved with Color 2 highlighted restores on Color 1", () => {
  it("keeps Color 1 for the saved plan and the next autosave", { timeout: 90_000 }, async () => {
    await renderDesigner({ styleId: COLOR_TWO, styleA: COLOR_ONE, styleB: COLOR_TWO, activeSlot: "B" });
    expect(savedPlan.styleId).toBe(COLOR_ONE);
    const saved = await autosaved();
    expect(saved).toMatchObject({ styleId: COLOR_TWO, styleA: COLOR_ONE, styleB: COLOR_TWO, activeSlot: "B" });
    expect(saved.placed?.map((item) => item.styleId)).toEqual([COLOR_ONE, COLOR_ONE, null, null]);
  });

  it("recovers Color 1 from the cabinets when an older draft did not save it", { timeout: 90_000 }, async () => {
    await renderDesigner({ styleId: COLOR_TWO, styleB: COLOR_TWO, activeSlot: "B" });
    expect(savedPlan.styleId).toBe(COLOR_ONE);
    expect((await autosaved()).styleA).toBe(COLOR_ONE);
  });

  it("never guesses a third accent as Color 1; the inherited finish stays as saved", { timeout: 90_000 }, async () => {
    const THIRD_ACCENT = 390019;
    await renderDesigner({
      styleId: COLOR_TWO, styleB: COLOR_TWO, activeSlot: "B",
      placed: [...KITCHEN.slice(0, 3), { ...KITCHEN[3]!, styleId: THIRD_ACCENT }],
    });
    expect(savedPlan.styleId).toBe(COLOR_TWO);
    const saved = await autosaved();
    expect(saved.styleA).toBe(COLOR_TWO);
    expect(saved.placed?.map((item) => item.styleId)).toEqual([COLOR_ONE, COLOR_ONE, null, THIRD_ACCENT]);
  });

  it("leaves a Color 1 draft as it was", { timeout: 90_000 }, async () => {
    await renderDesigner({ styleId: COLOR_ONE, styleB: COLOR_TWO, activeSlot: "A" });
    expect(savedPlan.styleId).toBe(COLOR_ONE);
    expect(await autosaved()).toMatchObject({ styleId: COLOR_ONE, styleA: COLOR_ONE, activeSlot: "A" });
  });
});
