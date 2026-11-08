// @vitest-environment jsdom
/**
 * The owner's report: in the bathroom designer a selected vanity would not
 * delete. These tests drive the real Designer page through every delete path —
 * the on-canvas control, the keyboard, the tablet/phone selected-item panel, and
 * the right-click menu — and assert the vanity's basin and faucet leave the
 * design and the cart with it.
 *
 * The Designer is a ~25k-line page with a WebGL viewer behind it, so the viewer
 * is stubbed and the saved draft is used as the observation point: it is the
 * exact snapshot the quote and cart are priced from.
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
    user: { id: 1, role: "admin", email: "owner@cabinetdealz.test", name: "Owner" },
    isAuthenticated: true,
    loading: false,
    logout: async () => {},
  }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: async () => ({}), getSession: async () => ({ data: { session: null } }) } },
}));
// The real viewer needs WebGL; the delete paths live in the page, not the renderer.
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, InteractiveRoom3D: () => <div data-testid="mock-3d" /> };
});

if (!(HTMLElement.prototype as any).setPointerCapture) {
  (HTMLElement.prototype as any).setPointerCapture = () => {};
  (HTMLElement.prototype as any).releasePointerCapture = () => {};
  (HTMLElement.prototype as any).hasPointerCapture = () => false;
}
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

// A signed-in draft is filed under the ACCOUNT, not the gate email.
const DRAFT_KEY = "cabinet-dealz:designer-draft:v2:owner:acct-1";

const vanity = {
  uid: "vanity-1",
  cabinetId: 501,
  masterCode: "VSB24",
  description: '24" Vanity Sink Base',
  category: "Vanity",
  subCategory: "Vanity Cabinets",
  placement: "base",
  x: 40,
  y: 0,
  width: 24,
  depth: 21,
  height: 34.5,
  wallId: "top",
  wallOffset: 40,
  rotation: 0,
  mountBottom: 0,
};

/** The basin and vanity faucet installed in `vanity`, as the picker creates them. */
const sink = {
  uid: "sink-1",
  type: "single",
  x: 43,
  y: 4,
  width: 18,
  depth: 14,
  faucet: true,
  cabinetUid: "vanity-1",
  pelicanProductId: 7011,
  pelicanProductName: "PL-12030 Vanity Basin",
  pelicanFaucetProductId: 7012,
  pelicanFaucetProductName: "PL-8112 Vanity Faucet",
};

const basinSurface = {
  id: 7011, slug: "pl-12030", name: "PL-12030 Vanity Basin", category: "Sinks & Faucets",
  subCategory: "Sinks", size: null, imageUrl: null, sellPrice: 210,
};
const faucetSurface = {
  id: 7012, slug: "pl-8112", name: "PL-8112 Vanity Faucet", category: "Sinks & Faucets",
  subCategory: "Faucets", size: null, imageUrl: null, sellPrice: 145,
};

function seed() {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
    v: 2,
    originScope: "owner",
    savedAt: Date.now(),
    roomType: "bathroom",
    room: { width: 120, depth: 120, ceilingHeight: 96 },
    placed: [vanity],
    openings: [],
    sinks: [sink],
    furniture: [],
    potFillers: [],
    ponyWalls: [],
    annotations: [],
    styleId: 1,
    countertop: true,
    selectedSurfaces: [basinSurface, faucetSurface],
  }));
}

async function renderDesigner(width = 1500) {
  seed();
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
  const planButton = screen.queryByTestId("switch-to-floor-plan");
  if (planButton) {
    await act(async () => { fireEvent.click(planButton); });
  }
}

const vanityOnPlan = () => document.querySelector(`[title*='${vanity.masterCode}']`) as HTMLElement | null;

async function selectVanity() {
  const el = vanityOnPlan();
  expect(el, "the vanity should be on the floor plan").toBeTruthy();
  await act(async () => {
    fireEvent.pointerDown(el!, { clientX: 60, clientY: 20, button: 0, pointerId: 1 });
    fireEvent.pointerUp(el!, { clientX: 60, clientY: 20, button: 0, pointerId: 1 });
  });
  return el!;
}

type SavedDraft = {
  placed: Array<{ uid: string }>;
  sinks: Array<{ uid: string }>;
  countertop?: boolean;
  selectedSurfaces?: Array<{ id: number }>;
};

/** The persisted draft is the same snapshot the cart and quote are priced from. */
async function savedDraft(): Promise<SavedDraft> {
  // The draft write is debounced; give it its window before reading.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
  const raw = window.localStorage.getItem(DRAFT_KEY);
  expect(raw, "the draft should have been written").toBeTruthy();
  return JSON.parse(raw!) as SavedDraft;
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer?room=bathroom");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("A selected bathroom vanity deletes from every path", () => {
  it(
    "removes the vanity, its basin, its faucet, and their cart rows from the on-canvas control",
    { timeout: 90_000 },
    async () => {
      await renderDesigner();
      await selectVanity();

      await act(async () => { fireEvent.click(screen.getByLabelText("Delete cabinet")); });
      await act(async () => {});

      expect(vanityOnPlan()).toBeNull();
      const draft = await savedDraft();
      expect(draft.placed).toHaveLength(0);
      // The basin and faucet go with the vanity instead of being orphaned on the top…
      expect(draft.sinks).toHaveLength(0);
      // …and their catalog rows leave the cart with them.
      expect((draft.selectedSurfaces ?? []).map((surface) => surface.id)).toEqual([]);
      // A countertop over nothing is not a line item either.
      expect(draft.countertop).toBe(false);
    },
  );

  it("removes the vanity and its basin with the Delete key", { timeout: 90_000 }, async () => {
    await renderDesigner();
    await selectVanity();

    await act(async () => { fireEvent.keyDown(window, { key: "Delete", bubbles: true }); });
    await act(async () => {});

    expect(vanityOnPlan()).toBeNull();
    const draft = await savedDraft();
    expect(draft.placed).toHaveLength(0);
    expect(draft.sinks).toHaveLength(0);
  });

  it("removes the vanity with Backspace, as a laptop keyboard sends it", { timeout: 90_000 }, async () => {
    await renderDesigner();
    await selectVanity();
    await act(async () => { fireEvent.keyDown(window, { key: "Backspace", bubbles: true }); });
    await act(async () => {});
    expect(vanityOnPlan()).toBeNull();
    expect((await savedDraft()).sinks).toHaveLength(0);
  });

  it("removes the vanity from the Remove action in the right-click menu", { timeout: 90_000 }, async () => {
    await renderDesigner();
    const el = await selectVanity();
    await act(async () => { fireEvent.contextMenu(el, { clientX: 60, clientY: 20, button: 2 }); });

    await act(async () => { fireEvent.click(screen.getByTestId("placed-item-menu-remove")); });
    await act(async () => {});

    expect(vanityOnPlan()).toBeNull();
    const draft = await savedDraft();
    expect(draft.placed).toHaveLength(0);
    expect(draft.sinks).toHaveLength(0);
  });

  it("leaves a second vanity's own basin alone when one of two is deleted", { timeout: 90_000 }, async () => {
    window.localStorage.setItem(DRAFT_KEY, "");
    cleanup();
    await renderDesigner();
    // Re-seed with two vanities, each with its own basin, and delete the first.
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
      v: 2, originScope: "owner", savedAt: Date.now(), roomType: "bathroom",
      room: { width: 160, depth: 120, ceilingHeight: 96 },
      placed: [vanity, { ...vanity, uid: "vanity-2", masterCode: "VSB30", x: 70, wallOffset: 70, width: 30 }],
      openings: [], furniture: [], potFillers: [], ponyWalls: [], annotations: [],
      sinks: [sink, { ...sink, uid: "sink-2", cabinetUid: "vanity-2", x: 75, pelicanProductId: 7021, pelicanFaucetProductId: 7022 }],
      styleId: 1, countertop: true,
      selectedSurfaces: [basinSurface, faucetSurface,
        { ...basinSurface, id: 7021, name: "Second basin" },
        { ...faucetSurface, id: 7022, name: "Second faucet" }],
    }));
    cleanup();
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

    await selectVanity();
    await act(async () => { fireEvent.keyDown(window, { key: "Delete", bubbles: true }); });
    await act(async () => {});

    const draft = await savedDraft();
    expect(draft.placed.map((item) => item.uid)).toEqual(["vanity-2"]);
    expect(draft.sinks.map((item) => item.uid)).toEqual(["sink-2"]);
  });
});

describe("A tablet has a delete control on the panel that opens on selection", () => {
  it("deletes the vanity from the selected-item panel, with no keyboard", { timeout: 90_000 }, async () => {
    await renderDesigner(768);
    await selectVanity();

    // Selecting opens the modal selected-item panel on a tablet. It covers the
    // bottom strip, so the panel itself has to carry Delete.
    const panelDelete = screen.getByTestId("mobile-selected-cabinet-delete");
    expect((panelDelete as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(panelDelete); });
    await act(async () => {});

    expect(vanityOnPlan()).toBeNull();
    const draft = await savedDraft();
    expect(draft.placed).toHaveLength(0);
    expect(draft.sinks).toHaveLength(0);
  });

  it("closes the selected-item panel without deleting anything", { timeout: 90_000 }, async () => {
    await renderDesigner(768);
    await selectVanity();
    await act(async () => { fireEvent.click(screen.getByTestId("mobile-selected-cabinet-close")); });
    await act(async () => {});
    expect(document.querySelector("[data-slot='sheet-content']")).toBeNull();
    expect(vanityOnPlan()).toBeTruthy();
    expect((await savedDraft()).placed).toHaveLength(1);
  });
});
