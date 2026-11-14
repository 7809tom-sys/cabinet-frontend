// @vitest-environment jsdom
/**
 * Canvas-only ("immersive") mode is a workspace mode, not a design action: it
 * hides the site header, the page-history row and both Designer toolbars so the
 * 3D canvas fills the screen, and it comes back the same way it went in — the
 * toggle, Esc, or leaving browser fullscreen.
 *
 * Esc is the delicate part. The handler listens in the capture phase so the
 * Designer's own Escape shortcut (clear the selection) does not also fire, which
 * means every layer on top of the canvas — dialogs, menus, text fields — must
 * keep its keystrokes. These tests drive the real page to prove both.
 *
 * Mounting the full Designer is expensive (it is a 20k-line page with a WebGL
 * viewer behind it), so each test walks every scenario on one mount.
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

/** The flag the site header and the history row read. */
function canvasOnlyPublished(): boolean {
  return Boolean((window as unknown as Record<string, unknown>).__designerCanvasOnly);
}

function canvasOnlyAttribute(): string | null {
  return screen.getByTestId("designer-root").getAttribute("data-canvas-only");
}

async function escapeOn(target: EventTarget, init: KeyboardEventInit = {}) {
  let dispatched: Event;
  await act(async () => {
    dispatched = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
      ...init,
    } as KeyboardEventInit);
    target.dispatchEvent(dispatched);
  });
  return dispatched!;
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
  it("publishes the flag on the toggle and takes it back only for an Esc that is ours", { timeout: 120_000 }, async () => {
    await renderDesigner();
    // The faucet & sink pop-up opens with a kitchen (15-rule spec, rule 1). It owns Esc while
    // it is open, so close it the way a customer would before testing canvas-only Esc.
    const skipFixturePick = screen.queryByTestId("fixture-pick-skip");
    if (skipFixturePick) fireEvent.click(skipFixturePick);
    expect(canvasOnlyPublished()).toBe(false);
    expect(screen.queryByTestId("designer-toolbar")).toBeTruthy();

    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
    expect(canvasOnlyPublished()).toBe(true);
    expect(canvasOnlyAttribute()).toBe("true");
    expect(screen.getByTestId("designer-toolbar").getAttribute("data-canvas-only-hidden")).toBe("true");
    expect(screen.getByTestId("three-d-immersive-toggle").getAttribute("aria-pressed")).toBe("true");

    // 1. A dialog owns its Esc: the key is neither consumed nor acted on.
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const dialogButton = document.createElement("button");
    dialog.appendChild(dialogButton);
    document.body.appendChild(dialog);
    const inDialog = await escapeOn(dialogButton);
    expect(inDialog.defaultPrevented).toBe(false);
    expect(canvasOnlyPublished()).toBe(true);
    dialog.remove();

    // 2. A text field owns its Esc, so a half-typed value survives.
    const input = document.createElement("input");
    document.body.appendChild(input);
    const inInput = await escapeOn(input);
    expect(inInput.defaultPrevented).toBe(false);
    expect(canvasOnlyPublished()).toBe(true);
    input.remove();

    // 3. Browser chords that include Esc are the browser's.
    await escapeOn(window, { key: "Escape", metaKey: true });
    expect(canvasOnlyPublished()).toBe(true);
    await escapeOn(window, { key: "Escape", ctrlKey: true });
    expect(canvasOnlyPublished()).toBe(true);
    await escapeOn(window, { key: "Escape", altKey: true });
    expect(canvasOnlyPublished()).toBe(true);
    // A non-Esc key never exits either.
    await escapeOn(window, { key: "Enter" });
    expect(canvasOnlyPublished()).toBe(true);

    // 4. With no owner above the canvas, Esc exits and hands the flag back.
    await escapeOn(window);
    expect(canvasOnlyPublished()).toBe(false);
    expect(canvasOnlyAttribute()).toBeNull();
    expect(screen.getByTestId("designer-toolbar").getAttribute("data-canvas-only-hidden")).toBeNull();
    expect(screen.getByTestId("three-d-immersive-toggle").getAttribute("aria-pressed")).toBe("false");
  });

  it("clears every bar when the browser ends fullscreen itself", { timeout: 120_000 }, async () => {
    // Commit 5c38101's fix: the browser's own Esc closes the fullscreen session
    // without passing through our key handler, so `fullscreenchange` must clear
    // AND publish the flag. A raw state setter leaves every bar hidden.
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.resolve(),
    });
    const announced: boolean[] = [];
    const listener = (event: Event) => announced.push(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(DESIGNER_CANVAS_ONLY_EVENT, listener);

    await renderDesigner();
    fireEvent.click(screen.getByTestId("three-d-immersive-toggle"));
    expect(canvasOnlyPublished()).toBe(true);

    // Fullscreen ended without us: `fullscreenElement` is null again.
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    window.removeEventListener(DESIGNER_CANVAS_ONLY_EVENT, listener);

    expect(canvasOnlyPublished()).toBe(false);
    expect(canvasOnlyAttribute()).toBeNull();
    expect(screen.getByTestId("designer-toolbar").getAttribute("data-canvas-only-hidden")).toBeNull();
    // Published on the shared event, so chrome outside the Designer agrees too.
    expect(announced).toEqual([true, false]);
  });
});
