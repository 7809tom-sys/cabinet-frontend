// @vitest-environment jsdom
/**
 * Focus 3D is a workspace mode, not a design action: it hides the Designer's
 * toolbars, the selected-cabinet bar, and the side panels so the 3D canvas fills
 * the screen, and it comes back the same way it went in — the Exit focus button,
 * Esc, or leaving browser fullscreen. Nothing about the plan changes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
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
    user: {
      id: 1,
      role: "admin",
      email: "admin@cabinetdealz.test",
      name: "Admin",
    },
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
// The real 3D viewer needs WebGL; jsdom only needs to prove the host wires the
// toggle to it and that the real control exists, so this stand-in reproduces
// both the focus button and the cabinet-select callback.
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    InteractiveRoom3D: ({
      focus3DActive,
      onToggleFocus3D,
      onSelectCabinet,
      placed,
    }: {
      focus3DActive?: boolean;
      onToggleFocus3D?: () => void;
      onSelectCabinet?: (uid: string) => void;
      placed?: Array<{ uid: string }>;
    }) => (
      <div data-testid="mock-3d">
        {onToggleFocus3D && (
          <button
            type="button"
            data-testid="three-d-focus-toggle"
            aria-pressed={Boolean(focus3DActive)}
            aria-label={focus3DActive ? "Exit focus" : "Focus 3D"}
            onClick={onToggleFocus3D}
          >
            {focus3DActive ? "Exit focus" : null}
          </button>
        )}
        {onSelectCabinet && placed?.[0] && (
          <button
            type="button"
            data-testid="mock-3d-select"
            onClick={() => onSelectCabinet(placed[0].uid)}
          />
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

const DRAFT_KEY =
  "cabinet-dealz:designer-draft:v2:owner:admin@cabinetdealz.test";

/** One placed base cabinet: enough for the Designer to render its 3D workspace. */
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
    JSON.stringify({
      v: 2,
      originScope: "owner",
      savedAt: Date.now(),
      placed: [baseCabinet],
    }),
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

function canvasChromeElements() {
  return {
    toolbar: screen.queryByTestId("designer-toolbar"),
    canvas: screen.queryByTestId("designer-canvas"),
  };
}

/** The two inline desktop columns (catalog and pricing) that frame the canvas. */
function sideColumns() {
  return document.querySelectorAll(".w-60, .w-72");
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
  // jsdom has no Fullscreen API; Focus 3D must still work without it.
  delete (document as unknown as Record<string, unknown>).exitFullscreen;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .requestFullscreen;
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => null,
  });
});

afterEach(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .requestFullscreen;
  cleanup();
});

describe("Focus 3D", () => {
  it("renders one small square Focus 3D control and no extra floating canvas icons", async () => {
    await renderDesigner();
    const toggle = screen.getByTestId("three-d-focus-toggle");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.textContent ?? "").not.toContain("Sample door");
    expect(screen.queryByTestId("three-d-sample-door-compare")).toBeNull();
  });

  it("puts the control in the 3D viewer's own top-right cluster, as a thumb-sized square", () => {
    // jsdom gives import.meta.url an http scheme, so resolve from the repo root.
    const componentDir = path.resolve(
      process.cwd(),
      "client/src/components/design",
    );
    const viewer = readFileSync(
      path.join(componentDir, "InteractiveRoom3D.tsx"),
      "utf8",
    );
    const toggle = readFileSync(
      path.join(componentDir, "DesignerFocus3DToggle.tsx"),
      "utf8",
    );
    // The control renders inside the embedded toolbar the viewer already places
    // at the top right of the canvas, next to the layout pop-up trigger.
    const clusterStart = viewer.indexOf(
      'data-testid="three-d-mobile-canvas-tools"',
    );
    const cluster = viewer.slice(
      clusterStart,
      viewer.indexOf("</div></>}", clusterStart),
    );
    expect(cluster).toContain("{focus3DControl}");
    expect(viewer).toContain('testId="three-d-focus-toggle"');

    // Small square when idle, readable "Exit focus" pill when on, 44px on touch.
    expect(toggle).toContain('compact ? "h-11" : "h-9"');
    expect(toggle).toContain('compact ? "w-11" : "w-9"');
    expect(toggle).toContain("Exit focus");
    expect(toggle).toContain("Focus 3D");
    // No floating action icons and no sample-door compare in this PR.
    expect(toggle).not.toContain("Sample door");
  });

  it("hides both toolbars, the selected-cabinet bar, and the side panels, and restores them from Exit focus", async () => {
    await renderDesigner();
    const { toolbar, canvas } = canvasChromeElements();
    expect(toolbar).toBeTruthy();
    expect(canvas!.getAttribute("data-focus-3d")).toBeNull();
    // Desktop columns are present before focus mode.
    expect(sideColumns().length).toBeGreaterThan(0);

    // Selecting a cabinet shows the contextual selected-cabinet bar.
    fireEvent.click(screen.getByTestId("mock-3d-select"));
    expect(screen.getByTestId("designer-selected-cabinet-bar")).toBeTruthy();

    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));

    expect(canvas!.getAttribute("data-focus-3d")).toBe("true");
    expect(
      screen.getByTestId("designer-workspace").getAttribute("data-focus-3d"),
    ).toBe("true");
    // Both toolbar rows and the contextual selected-cabinet bar leave the page.
    expect(screen.queryByTestId("designer-toolbar")).toBeNull();
    expect(screen.queryByTestId("designer-selected-cabinet-bar")).toBeNull();
    // The catalog and pricing columns are gone too, so the canvas is the layout.
    expect(sideColumns()).toHaveLength(0);
    // The camera pad belongs to the viewer, so it is untouched by focus mode.
    expect(screen.getByTestId("mock-3d")).toBeTruthy();

    const exit = screen.getByTestId("three-d-focus-toggle");
    expect(exit.getAttribute("aria-label")).toBe("Exit focus");
    expect(exit.textContent).toContain("Exit focus");
    fireEvent.click(exit);

    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBeNull();
    expect(screen.getByTestId("designer-toolbar")).toBeTruthy();
    expect(screen.getByTestId("designer-selected-cabinet-bar")).toBeTruthy();
    expect(sideColumns().length).toBeGreaterThan(0);
  });

  it("restores the Designer on Esc", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));
    expect(screen.queryByTestId("designer-toolbar")).toBeNull();

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBeNull();
    expect(screen.getByTestId("designer-toolbar")).toBeTruthy();
  });

  it("leaves Esc to an open dialog or text field instead of stealing it", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));

    const insideInput = document.createElement("input");
    document.body.appendChild(insideInput);
    const inputEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    insideInput.dispatchEvent(inputEvent);
    expect(inputEvent.defaultPrevented).toBe(false);
    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBe("true");

    insideInput.remove();
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBeNull();
  });

  it("requests browser fullscreen where supported and leaves the layout intact when it is refused", async () => {
    const requestFullscreen = vi.fn(async () => {});
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    await renderDesigner();

    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBe("true");

    cleanup();

    const refused = vi.fn(async () => {
      throw new Error("denied");
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: refused,
    });
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));
    await act(async () => {});
    // A refused request never blocks focus mode.
    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBe("true");
  });

  it("leaves focus mode when the browser exits fullscreen", async () => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => {},
    });
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));
    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBe("true");

    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBeNull();
  });

  it("works the same on tablet widths", async () => {
    await renderDesigner(768);
    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));
    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBe("true");
    expect(screen.queryByTestId("designer-toolbar")).toBeNull();
    fireEvent.click(screen.getByTestId("three-d-focus-toggle"));
    expect(
      screen.getByTestId("designer-canvas").getAttribute("data-focus-3d"),
    ).toBeNull();
  });
});
