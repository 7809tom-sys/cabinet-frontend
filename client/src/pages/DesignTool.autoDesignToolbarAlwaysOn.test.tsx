// @vitest-environment jsdom
/**
 * Tom (owner voice, Nov 24 2026):
 * - 12:36 PM CT: one always-visible Auto-Design button in the toolbar/options area,
 *   still there after a blueprint is built and walls are deleted; anything that
 *   blocks a build is explained inside the popup.
 * - 12:35 PM CT (final): Apply Wall first, then a Yes/No prompt; Yes opens the
 *   Auto-Design questions directly, No closes it and the toolbar still works.
 * - 12:26-12:27 PM CT: no vendor/color or catalog selector anywhere in that flow.
 *
 * Mounts the real Designer as a signed-out visitor. The room layout starter is
 * mocked to a single "Apply Wall" button that hands the Designer a finished
 * continuous-wall outline through the same `onApplyContinuousRoom` callback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DesignTool from "./DesignTool";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const { router, lastBaseInput } = vi.hoisted(() => {
  const DATA: Record<string, unknown> = {
    "distributors.list": [
      { id: 1, name: "Line One" },
      { id: 2, name: "Line Two" },
    ],
    "doorStyles.list": [
      { id: 11, distributorId: 1, ourName: "White Shaker", styleCode: "WS" },
      { id: 12, distributorId: 1, ourName: "Espresso Shaker", styleCode: "ES" },
      { id: 21, distributorId: 2, ourName: "Gray Slab", styleCode: "GS" },
    ],
  };
  const base = {
    isLoading: false, isPending: false, isError: false, isFetching: false,
    error: null, refetch: async () => ({}),
  };
  // One stable result object per path, so effects keyed on query data settle.
  const results = new Map<string, unknown>();
  const resultFor = (path: string) => {
    if (!results.has(path)) {
      const data = DATA[path];
      results.set(path, { ...base, data, isSuccess: data !== undefined });
    }
    return results.get(path);
  };
  const lastBaseInput: { current: unknown } = { current: undefined };
  const mutationResult = { mutate: () => {}, mutateAsync: async () => ({}), isPending: false, reset: () => {}, error: null };
  // One stable proxy per path too: the page keeps tRPC utils in effect deps.
  const proxies = new Map<string, any>();
  const make = (path: string[]): any => {
    const id = path.join(".");
    if (!proxies.has(id)) proxies.set(id, makeProxy(path));
    return proxies.get(id);
  };
  const makeProxy = (path: string[]): any => new Proxy(function noop() {}, {
    get(_t, prop) {
      if (typeof prop === "symbol") return undefined;
      const key = path.join(".");
      if (prop === "useQuery") return (input: unknown) => {
        if (key === "design.placeableCabinets" && (input as { placement?: string } | undefined)?.placement === "base") {
          lastBaseInput.current = input;
        }
        return resultFor(key);
      };
      if (prop === "useSuspenseQuery") return () => resultFor(key);
      if (prop === "useMutation") return () => mutationResult;
      if (prop === "useInfiniteQuery") return () => ({ ...(resultFor(key) as object), fetchNextPage: async () => {} });
      if (prop === "setData" || prop === "invalidate" || prop === "fetch" || prop === "cancel") return async () => ({});
      return make([...path, prop]);
    },
    apply() { return make(path); },
  });
  return { router: make([]), lastBaseInput };
});

vi.mock("@/lib/trpc", () => ({ trpc: router }));
vi.mock("@/components/design/RoomLayoutStarter", () => ({
  RoomLayoutStarter: (props: { onApplyContinuousRoom?: (outline: unknown) => void }) => (
    <button type="button" data-testid="mock-apply-wall" onClick={() => props.onApplyContinuousRoom?.({
      width: 144, depth: 120, openWallPath: false,
      vertices: [{ id: "v1", x: 0, y: 0 }, { id: "v2", x: 144, y: 0 }, { id: "v3", x: 144, y: 120 }, { id: "v4", x: 0, y: 120 }],
      customWalls: [
        { id: "w1", startVertexId: "v1", endVertexId: "v2", label: "Wall 1" },
        { id: "w2", startVertexId: "v2", endVertexId: "v3", label: "Wall 2" },
        { id: "w3", startVertexId: "v3", endVertexId: "v4", label: "Wall 3" },
        { id: "w4", startVertexId: "v4", endVertexId: "v1", label: "Wall 4" },
      ],
    })}>Apply Wall</button>
  ),
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, loading: false, logout: async () => {} }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: async () => ({}), getSession: async () => ({ data: { session: null } }) } },
}));
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, InteractiveRoom3D: () => <div data-testid="mock-3d" /> };
});

const proto = HTMLElement.prototype as any;
proto.setPointerCapture ??= () => {};
proto.releasePointerCapture ??= () => {};
proto.hasPointerCapture ??= () => false;
proto.scrollIntoView ??= () => undefined;
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };
const DISPLAY = new Set(["hidden", "block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "contents", "table"]);
function displayAt(element: Element, width: number): string {
  let display = "inline";
  for (const token of (element.getAttribute("class") ?? "").split(/\s+/)) {
    if (!token) continue;
    const [prefix, ...rest] = token.split(":");
    const utility = rest.length ? rest.join(":") : prefix;
    if (!DISPLAY.has(utility)) continue;
    if (rest.length === 0) { display = utility; continue; }
    const min = BREAKPOINTS[prefix];
    if (min != null && width >= min) display = utility;
  }
  return display;
}
function visibleAt(element: Element | null, width: number): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (displayAt(node, width) === "hidden") return false;
  }
  return element != null;
}
function stubViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    // A desktop has a mouse; phones and tablets (under 1024px) have a finger.
    const matches = /pointer:\s*coarse/.test(query)
      ? width < 1024
      : (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
  }) as unknown as typeof window.matchMedia;
}


const handPlaced = {
  uid: "base-1", cabinetId: 12, masterCode: "B24", description: '24" Base Cabinet',
  category: "Base Cabinets", subCategory: "Base Cabinets", placement: "base",
  x: 40, y: 0, width: 24, depth: 24, height: 34.5, wallId: "back", wallOffset: 64, rotation: 0, mountHeightIn: 0,
};

function seedDraft(styleId: number | null, extra: Record<string, unknown> = {}) {
  window.localStorage.setItem(
    "cabinet-dealz:designer-draft:v2:owner:visitor@example.com",
    JSON.stringify({
      v: 2, originScope: "owner", savedAt: Date.now(),
      room: { width: 132, depth: 108, ceilingHeight: 96 },
      placed: [], openings: [],
      ...(styleId != null ? { styleId } : {}),
      ...extra,
    }),
  );
}

async function renderDesigner(width: number) {
  stubViewport(width);
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
  fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "visitor@example.com" } });
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: /Launch Designer/i }));
  await act(async () => {});
}

async function flushTimers() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

function toolbarButton(): HTMLButtonElement {
  const button = screen.getByTestId("admin-auto-design-auto-build") as HTMLButtonElement;
  expect(visibleAt(button, 1280)).toBe(true);
  expect(button.disabled).toBe(false);
  return button;
}

async function applyWall() {
  const layout = screen.queryAllByLabelText("Room layout").find((element) => visibleAt(element, 1280));
  if (layout) {
    fireEvent.click(layout);
  } else {
    fireEvent.click(screen.getByTestId("compact-workspace-more-trigger"));
    await act(async () => {});
    fireEvent.click(within(await screen.findByRole("dialog")).getByText("Room layout"));
  }
  await act(async () => {});
  fireEvent.click(await screen.findByTestId("room-layout-popup-kitchen"));
  await act(async () => {});
  fireEvent.click(await screen.findByTestId("mock-apply-wall"));
  await flushTimers();
}

function expectNoPickers() {
  expect(screen.queryByTestId("fresh-room-catalog-setup")).toBeNull();
  expect(screen.queryByText("Choose your cabinet vendor and color")).toBeNull();
  expect(screen.queryByText("Continue to cabinet catalog")).toBeNull();
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
});
afterEach(cleanup);

describe("Apply Wall, then a Yes/No Auto-Design prompt", () => {
  it("Yes opens the Auto-Design questions directly, with no vendor or catalog picker", { timeout: 60_000 }, async () => {
    seedDraft(21);
    await renderDesigner(1280);
    await applyWall();
    const prompt = await screen.findByTestId("apply-wall-auto-design-prompt");
    expect(prompt.textContent).toContain("Want Auto-Design to lay out this kitchen?");
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
    fireEvent.click(within(prompt).getByTestId("apply-wall-auto-design-yes"));
    await flushTimers();
    expectNoPickers();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
  });

  it("No closes the prompt, and the toolbar Auto-Design button still opens Auto-Design", { timeout: 60_000 }, async () => {
    seedDraft(21);
    await renderDesigner(1280);
    await applyWall();
    fireEvent.click(within(await screen.findByTestId("apply-wall-auto-design-prompt")).getByTestId("apply-wall-auto-design-no"));
    await flushTimers();
    expect(screen.queryByTestId("apply-wall-auto-design-prompt")).toBeNull();
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
    fireEvent.click(toolbarButton());
    await flushTimers();
    expectNoPickers();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
  });
});

describe("one always-visible toolbar Auto-Design button", () => {
  it("is visible and enabled on an empty plan and opens Auto-Design directly", { timeout: 60_000 }, async () => {
    seedDraft(21);
    await renderDesigner(1280);
    fireEvent.click(toolbarButton());
    await flushTimers();
    expectNoPickers();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
    expect(screen.queryByTestId("auto-design-blocked-notice")).toBeNull();
  });

  it("stays visible and clickable after a blueprint and wall deletion, and explains the block inside the popup", { timeout: 60_000 }, async () => {
    // A built plan (cabinets on it) whose room lost walls: a three-wall open path.
    seedDraft(21, {
      placed: [handPlaced],
      room: {
        width: 144, depth: 120, ceilingHeight: 96, openWallPath: true,
        vertices: [{ id: "v1", x: 0, y: 0 }, { id: "v2", x: 144, y: 0 }, { id: "v3", x: 144, y: 120 }],
        customWalls: [
          { id: "w1", startVertexId: "v1", endVertexId: "v2", label: "Wall 1" },
          { id: "w2", startVertexId: "v2", endVertexId: "v3", label: "Wall 2" },
        ],
      },
    });
    await renderDesigner(1280);
    fireEvent.click(toolbarButton());
    await flushTimers();
    expectNoPickers();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
    expect(screen.getByTestId("auto-design-blocked-notice").textContent).toContain("hand-placed cabinet");
  });

  it("opens in a non-kitchen room and offers Switch to Kitchen inside the popup", { timeout: 60_000 }, async () => {
    window.history.replaceState(null, "", "/designer?room=bathroom");
    seedDraft(21);
    await renderDesigner(1280);
    fireEvent.click(toolbarButton());
    await flushTimers();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
    expect(screen.getByTestId("auto-design-blocked-action-switch-kitchen")).toBeTruthy();
  });
});
