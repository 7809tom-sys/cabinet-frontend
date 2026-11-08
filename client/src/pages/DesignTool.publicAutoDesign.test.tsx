// @vitest-environment jsdom
/**
 * Auto-Design is public. The owner asked for it to be available to everyone —
 * signed in or not, on the public Designer and on a storefront — in a kitchen.
 * This file mounts the real Designer as a signed-out visitor, with no affiliate
 * storefront URL, and proves the three toolbar surfaces and the floating canvas
 * rail (the only controls left in fullscreen) all offer it.
 *
 * The companion file `DesignTool.responsiveAutoDesign.test.tsx` covers the
 * admin viewer at 375 / 768 / 1280 px; this one only has to prove the audience.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
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
// A signed-out visitor: no account, no role, no storefront URL.
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
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
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  // The real viewer needs WebGL, so jsdom gets a stand-in that renders the same
  // floating column the real component owns: the fullscreen toggle plus the slots
  // the page passes in (its quick adds and Auto-Design).
  return {
    ...actual,
    InteractiveRoom3D: ({
      immersive,
      onToggleImmersive,
      floatingQuickActions,
      floatingAutoDesignAction,
    }: {
      immersive?: boolean;
      onToggleImmersive?: () => void;
      floatingQuickActions?: ReactNode;
      floatingAutoDesignAction?: ReactNode;
    }) => (
      <div data-testid="mock-3d">
        <div data-testid="three-d-floating-column">
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
          {floatingQuickActions}
          {floatingAutoDesignAction}
        </div>
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

const BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};
const DISPLAY_TOKENS = new Set([
  "hidden",
  "block",
  "inline",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "contents",
  "table",
]);

function displayAt(element: Element, width: number): string {
  let display = "inline";
  for (const token of element.className.split(/\s+/)) {
    if (!token) continue;
    const [prefix, ...rest] = token.split(":");
    const utility = rest.length ? rest.join(":") : prefix;
    if (!DISPLAY_TOKENS.has(utility)) continue;
    if (rest.length === 0) {
      display = utility;
      continue;
    }
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
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 900,
  });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches =
      (min ? width >= Number(min[1]) : true) &&
      (max ? width <= Number(max[1]) : true);
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

/** The visitor gate needs a valid email before the Designer renders. */
async function signInAsVisitor() {
  fireEvent.change(screen.getByLabelText(/Email address/i), {
    target: { value: "visitor@example.com" },
  });
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: /Launch Designer/i }));
  await act(async () => {});
}

/**
 * Fullscreen needs a 3D stage to hang its toggle on, and Auto-Design needs an
 * empty plan. A measured (non-default) room with nothing placed satisfies both:
 * the stage renders, and the build is allowed — exactly the state a visitor is
 * in after measuring their kitchen and before Auto-Design runs.
 */
function seedDraft() {
  window.localStorage.setItem(
    "cabinet-dealz:designer-draft:v2:owner:visitor@example.com",
    JSON.stringify({
      v: 2,
      originScope: "owner",
      savedAt: Date.now(),
      room: { width: 132, depth: 108, ceilingHeight: 96 },
      placed: [],
      openings: [],
    }),
  );
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

function triggerAt(width: number): HTMLElement {
  const candidates = [
    screen.queryByTestId("admin-auto-design-auto-build"),
    screen.queryByTestId("mobile-auto-design-auto-build"),
  ];
  const visible = candidates.find((element) => visibleAt(element, width));
  expect(
    visible,
    `a public Auto-Design trigger must be visible at ${width}px`,
  ).toBeTruthy();
  return visible as HTMLElement;
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
});

afterEach(cleanup);

describe("Auto-Design is public", () => {
  for (const width of [375, 768, 1280]) {
    it(`offers Auto-Design to a signed-out visitor with no storefront at ${width}px`, async () => {
      await renderDesigner(width);
      await signInAsVisitor();

      const trigger = triggerAt(width);
      expect((trigger as HTMLButtonElement).disabled).toBe(false);
      expect(trigger.getAttribute("aria-label")).toBe("Auto-Design");

      // The dishwasher-side choice came with it: the whole trio is public.
      const pickers = screen
        .queryAllByLabelText("Dishwasher side")
        .filter((element) => visibleAt(element, width));
      expect(pickers).toHaveLength(1);
    });
  }

  it("hides Auto-Design outside a kitchen for the same visitor", async () => {
    window.history.replaceState(null, "", "/designer?room=bathroom");
    await renderDesigner(1280);
    await signInAsVisitor();

    expect(screen.queryByTestId("admin-auto-design-auto-build")).toBeNull();
    expect(screen.queryByTestId("mobile-auto-design-auto-build")).toBeNull();
    expect(screen.queryByTestId("three-d-floating-auto-design")).toBeNull();
  });

  it("opens the measured build from the toolbar for a visitor", async () => {
    await renderDesigner(1280);
    await signInAsVisitor();

    fireEvent.click(triggerAt(1280));
    await act(async () => {});
    expect(
      await screen.findByTestId("auto-design-auto-build-dialog"),
    ).toBeTruthy();
  });
});

describe("Auto-Design is reachable from the floating column (fullscreen)", () => {
  it("puts Auto-Design in the one floating column with Add cabinet and Add hardware", { timeout: 60_000 }, async () => {
    seedDraft();
    await renderDesigner(1280);
    await signInAsVisitor();
    // The column belongs to the 3D stage, which only mounts in the 3D view.
    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
    await act(async () => {});

    const column = screen.getByTestId("three-d-floating-column");
    expect(within(column).getByTestId("three-d-floating-add-cabinet")).toBeTruthy();
    expect(within(column).getByTestId("three-d-floating-add-hardware")).toBeTruthy();
    const auto = within(column).getByTestId(
      "three-d-floating-auto-design",
    ) as HTMLButtonElement;
    expect(auto.disabled).toBe(false);
    expect(auto.getAttribute("aria-label")).toBe("Auto-Design");
    // One column only: the standalone 2D rail never also draws over the 3D stage.
    expect(screen.queryByTestId("designer-canvas-action-rail")).toBeNull();
  });

  // Mounting the full Designer is expensive (a 20k-line page with a WebGL viewer
  // behind it), so the two fullscreen cases get room to settle.
  it(
    "keeps the rail and its Auto-Design action on screen once the toolbars are hidden",
    { timeout: 60_000 },
    async () => {
      seedDraft();
      await renderDesigner(1280);
      await signInAsVisitor();

      fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
      await act(async () => {});

      // Every toolbar surface is hidden, not removed, so they vanish from view…
      expect(
        screen
          .getByTestId("designer-toolbar")
          .getAttribute("data-canvas-only-hidden"),
      ).toBe("true");
      expect(
        visibleAt(screen.getByTestId("admin-auto-design-auto-build"), 1280),
      ).toBe(false);
      // …and the floating column is the remaining way in, exactly as the owner asked.
      const column = screen.getByTestId("three-d-floating-column");
      expect(visibleAt(column, 1280)).toBe(true);
      const auto = within(column).getByTestId("three-d-floating-auto-design");
      expect(visibleAt(auto, 1280)).toBe(true);
    },
  );

  it(
    "opens the measured build from the rail in fullscreen",
    { timeout: 60_000 },
    async () => {
      seedDraft();
      await renderDesigner(1280);
      await signInAsVisitor();

      fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
      await act(async () => {});
      fireEvent.click(screen.getByTestId("three-d-floating-auto-design"));
      await act(async () => {});

      expect(
        await screen.findByTestId("auto-design-auto-build-dialog"),
      ).toBeTruthy();
    },
  );

  // A tablet held in portrait is under the Designer's 1024px "mobile" breakpoint
  // (iPad portrait is 768–834 CSS px), so the rail used to be hidden there. In
  // fullscreen the bottom strip is hidden too, which left no control at all.
  it(
    "keeps Auto-Design reachable in fullscreen at tablet-portrait width",
    { timeout: 60_000 },
    async () => {
      seedDraft();
      await renderDesigner(834);
      await signInAsVisitor();

      // Not in fullscreen, the bottom strip carries the actions and the standalone
      // 2D rail stays out of the way. The 3D column is hidden at this width.
      expect(screen.queryByTestId("designer-canvas-action-rail")).toBeNull();

      fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
      await act(async () => {});

      // Fullscreen: the bottom strip is hidden and the rail takes over.
      expect(
        screen
          .getByTestId("mobile-designer-action-strip")
          .closest("[data-canvas-only-hidden]")
          ?.getAttribute("data-canvas-only-hidden"),
      ).toBe("true");
      const auto = within(
        screen.getByTestId("three-d-floating-column"),
      ).getByTestId("three-d-floating-auto-design");
      expect(visibleAt(auto, 834)).toBe(true);

      fireEvent.click(auto);
      await act(async () => {});
      expect(
        await screen.findByTestId("auto-design-auto-build-dialog"),
      ).toBeTruthy();
    },
  );
});
