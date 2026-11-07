// @vitest-environment jsdom
/**
 * Canvas-only ("immersive") mode is a workspace mode, not a design action: it
 * hides the site header, the page-history row and both Designer toolbars so the
 * 3D canvas fills the screen, and it comes back the same way it went in — the
 * toggle, Esc, or leaving browser fullscreen.
 *
 * Esc is the delicate part. The handler listens in the capture phase so the
 * Designer's own Escape shortcut (clear the selection) does not also fire, which
 * means every layer layered ABOVE the canvas — dialogs, menus, text fields —
 * must keep its keystrokes. These tests drive the real page to prove both.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DesignTool from "./DesignTool";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DESIGNER_CANVAS_ONLY_EVENT } from "@/hooks/useDesignerCanvasOnly";

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

function canvasOnlyPublished(): boolean {
  return Boolean((window as unknown as Record<string, unknown>).__designerCanvasOnly);
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
  // jsdom has no Fullscreen API; canvas-only must still work without it.
  delete (document as unknown as Record<string, unknown>).exitFullscreen;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).requestFullscreen;
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => null,
  });
});

afterEach(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).requestFullscreen;
  cleanup();
});

describe("canvas-only Esc handling", () => {
  it("hides the Designer toolbar and publishes the shared flag on the toggle", async () => {
    await renderDesigner();
    expect(canvasOnlyPublished()).toBe(false);
    expect(screen.queryByTestId("designer-toolbar")).toBeTruthy();

    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));

    expect(canvasOnlyPublished()).toBe(true);
    expect(
      screen.getByTestId("designer-root").getAttribute("data-canvas-only"),
    ).toBe("true");
    expect(
      screen.getByTestId("designer-toolbar").getAttribute("data-canvas-only-hidden"),
    ).toBe("true");
    expect(
      screen.getByTestId("three-d-immersive-toggle").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("restores the chrome on Esc and publishes the flag back", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
    expect(canvasOnlyPublished()).toBe(true);

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(canvasOnlyPublished()).toBe(false);
    expect(screen.getByTestId("designer-root").getAttribute("data-canvas-only")).toBeNull();
    expect(screen.getByTestId("designer-toolbar").getAttribute("data-canvas-only-hidden")).toBeNull();
    expect(
      screen.getByTestId("three-d-immersive-toggle").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("leaves Esc to an open dialog instead of stealing it", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const inner = document.createElement("button");
    dialog.appendChild(inner);
    document.body.appendChild(dialog);

    const dialogEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    inner.dispatchEvent(dialogEvent);

    expect(dialogEvent.defaultPrevented).toBe(false);
    expect(canvasOnlyPublished()).toBe(true);
    dialog.remove();
  });

  it("leaves Esc to a text field so a half-typed value survives", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));

    const input = document.createElement("input");
    document.body.appendChild(input);
    const inputEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(inputEvent);

    expect(inputEvent.defaultPrevented).toBe(false);
    expect(canvasOnlyPublished()).toBe(true);
    input.remove();

    // With the field gone, Esc is ours again.
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(canvasOnlyPublished()).toBe(false);
  });

  it("does not hijack Cmd+Esc or Ctrl+Esc", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape", metaKey: true });
    });
    expect(canvasOnlyPublished()).toBe(true);

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape", ctrlKey: true });
    });
    expect(canvasOnlyPublished()).toBe(true);
  });

  it("keeps the site header and history row reachable when the browser ends fullscreen itself", async () => {
    // Commit 5c38101's fix: the browser's own Esc closes the fullscreen session
    // without passing through our key handler, so `fullscreenchange` must clear
    // (and publish) the flag. A raw setter leaves every bar hidden.
    const root = { requestFullscreen: () => Promise.resolve() };
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: root.requestFullscreen,
    });
    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
    expect(canvasOnlyPublished()).toBe(true);

    // Fullscreen ended without us: `fullscreenElement` is null again.
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(canvasOnlyPublished()).toBe(false);
    expect(
      screen.getByTestId("designer-root").getAttribute("data-canvas-only"),
    ).toBeNull();
  });

  it("announces the flag on the shared event so chrome outside the Designer agrees", async () => {
    await renderDesigner();
    const seen: boolean[] = [];
    const listener = (event: Event) => seen.push(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(DESIGNER_CANVAS_ONLY_EVENT, listener);

    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    window.removeEventListener(DESIGNER_CANVAS_ONLY_EVENT, listener);
    expect(seen).toEqual([true, false]);
  });
});
