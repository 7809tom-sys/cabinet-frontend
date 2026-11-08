// @vitest-environment jsdom
/**
 * Tom's rule: deleting ANY cabinet takes the countertop over it with it, so the
 * top covers only the cabinets that remain. A run that loses a middle cabinet
 * becomes two pieces; a run that loses an end cabinet gets shorter.
 *
 * These drive the real Designer page, so the rule is proved on the delete path
 * itself — and Undo is proved to bring the top back with the cabinet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DesignTool from "./DesignTool";
import { countertopSurfaces, type PlacedCabinet } from "@/lib/design";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const { router } = vi.hoisted(() => {
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
  return { router: proxy };
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
// The real viewer needs WebGL; countertop geometry is what these tests read.
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
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 };

function base(uid: string, masterCode: string, x: number, width: number) {
  return {
    uid, cabinetId: 1, masterCode, description: `${width}" Base Cabinet`,
    category: "Base Cabinets", subCategory: "Base Cabinets", placement: "base",
    x, y: 0, width, depth: 24, height: 34.5, wallId: "top", wallOffset: x,
    rotation: 0, mountBottom: 0,
  };
}

/** A three-cabinet run: B24 at 0, B30 at 24, B27 at 54 (ends at 81). */
const RUN = [base("cab-a", "B24", 0, 24), base("cab-b", "B30", 24, 30), base("cab-c", "B27", 54, 27)];

function seed(placed: unknown[]) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
    v: 2, originScope: "owner", savedAt: Date.now(), roomType: "kitchen",
    room: ROOM,
    placed, openings: [], sinks: [], furniture: [], potFillers: [], ponyWalls: [], annotations: [],
    styleId: 1, countertop: true,
  }));
}

async function renderDesigner(placed: unknown[]) {
  seed(placed);
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
  const planButton = screen.queryByTestId("switch-to-floor-plan");
  if (planButton) await act(async () => { fireEvent.click(planButton); });
}

const cabinetOnPlan = (code: string) => document.querySelector(`[title*='${code}']`) as HTMLElement | null;

async function selectCabinet(code: string) {
  const el = cabinetOnPlan(code);
  expect(el, `${code} should be on the floor plan`).toBeTruthy();
  await act(async () => {
    fireEvent.pointerDown(el!, { clientX: 60, clientY: 20, button: 0, pointerId: 1 });
    fireEvent.pointerUp(el!, { clientX: 60, clientY: 20, button: 0, pointerId: 1 });
  });
}

async function deleteSelected() {
  await act(async () => { fireEvent.keyDown(window, { key: "Delete", bubbles: true }); });
  await act(async () => {});
}

/** Read the committed draft after its debounced write. */
async function draft(): Promise<{ countertop?: boolean; placed?: Array<{ uid: string }> }> {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
  return JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "{}");
}

/**
 * The countertop spans the app renders and prices for the cabinets that remain,
 * derived by the same rule the plan and the 3D view use.
 */
async function countertopSpans(): Promise<Array<{ start: number; end: number }>> {
  const saved = await draft();
  if (!saved.countertop) return [];
  const placed = RUN.filter((cabinet) => saved.placed?.some((item) => item.uid === cabinet.uid));
  return countertopSurfaces(placed as unknown as PlacedCabinet[], ROOM as never)
    .filter((surface) => surface.kind === "base")
    .map((surface) => ({
      start: Math.round(surface.x * 100) / 100,
      end: Math.round((surface.x + surface.width) * 100) / 100,
    }))
    .sort((left, right) => left.start - right.start);
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Deleting a cabinet takes the countertop over it", () => {
  it("gets shorter when an END cabinet is deleted", { timeout: 90_000 }, async () => {
    await renderDesigner(RUN);
    expect(await countertopSpans()).toEqual([{ start: 0, end: 81 }]);

    await selectCabinet("B27");
    await deleteSelected();

    expect((await draft()).placed?.map((item) => item.uid)).toEqual(["cab-a", "cab-b"]);
    // The 27" tail is gone; the top now ends where the last cabinet does.
    expect(await countertopSpans()).toEqual([{ start: 0, end: 54 }]);
  });

  it("splits into two pieces when a MIDDLE cabinet is deleted", { timeout: 90_000 }, async () => {
    await renderDesigner(RUN);
    await selectCabinet("B30");
    await deleteSelected();

    expect((await draft()).placed?.map((item) => item.uid)).toEqual(["cab-a", "cab-c"]);
    // No single slab may bridge the 24–54 hole the deleted base left.
    expect(await countertopSpans()).toEqual([
      { start: 0, end: 24 },
      { start: 54, end: 81 },
    ]);
  });

  it("leaves no countertop when the ONLY cabinet is deleted", { timeout: 90_000 }, async () => {
    await renderDesigner([base("solo", "B30", 0, 30)]);
    await selectCabinet("B30");
    await deleteSelected();

    expect((await draft()).placed).toEqual([]);
    expect(await countertopSpans()).toEqual([]);
    expect((await draft()).countertop).toBe(false);
  });

  it("restores the full countertop on Undo", { timeout: 90_000 }, async () => {
    await renderDesigner(RUN);
    await selectCabinet("B30");
    await deleteSelected();
    expect((await draft()).placed).toHaveLength(2);

    await act(async () => { fireEvent.click(screen.getByTestId("designer-undo")); });
    await act(async () => {});

    expect((await draft()).placed?.map((item) => item.uid).sort()).toEqual(["cab-a", "cab-b", "cab-c"]);
    // One continuous top again, back to full run length.
    expect(await countertopSpans()).toEqual([{ start: 0, end: 81 }]);
    expect((await draft()).countertop).toBe(true);
  });
});
