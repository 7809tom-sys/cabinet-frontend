// @vitest-environment jsdom
/**
 * Every designer start and Auto-Design open the same vendor / door-style step,
 * and that step shows catalog door sample photos rather than an empty
 * "choose a distributor first" box.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DesignTool from "./DesignTool";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const WHITE_DOOR = "https://cdn.example.test/white-shaker-door.jpg";
const GRAY_DOOR = "https://cdn.example.test/gray-slab-door.jpg";

const { router } = vi.hoisted(() => {
  const DATA: Record<string, unknown> = {
    "distributors.list": [
      { id: 1, name: "Line One" },
      { id: 2, name: "Line Two" },
    ],
    "doorStyles.list": [
      { id: 11, distributorId: 1, ourName: "White Shaker", styleCode: "WS", doorSampleImageUrl: "https://cdn.example.test/white-shaker-door.jpg" },
      { id: 12, distributorId: 1, ourName: "Espresso Shaker", styleCode: "ES", doorSampleImageUrl: "https://cdn.example.test/espresso-shaker-door.jpg" },
      { id: 21, distributorId: 2, ourName: "Gray Slab", styleCode: "GS", doorSampleImageUrl: "https://cdn.example.test/gray-slab-door.jpg" },
    ],
  };
  const base = {
    isLoading: false, isPending: false, isError: false, isFetching: false,
    error: null, refetch: async () => ({}),
  };
  const results = new Map<string, unknown>();
  const resultFor = (path: string) => {
    if (!results.has(path)) {
      const data = DATA[path];
      results.set(path, { ...base, data, isSuccess: data !== undefined });
    }
    return results.get(path);
  };
  const mutationResult = { mutate: () => {}, mutateAsync: async () => ({}), isPending: false, reset: () => {}, error: null };
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
      if (prop === "useQuery") return () => resultFor(key);
      if (prop === "useSuspenseQuery") return () => resultFor(key);
      if (prop === "useMutation") return () => mutationResult;
      if (prop === "useInfiniteQuery") return () => ({ ...(resultFor(key) as object), fetchNextPage: async () => {} });
      if (prop === "setData" || prop === "invalidate" || prop === "fetch" || prop === "cancel") return async () => ({});
      return make([...path, prop]);
    },
    apply() { return make(path); },
  });
  return { router: make([]) };
});

vi.mock("@/lib/trpc", () => ({ trpc: router }));
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

function stubViewport() {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (min ? 1280 >= Number(min[1]) : true) && (max ? 1280 <= Number(max[1]) : true);
    return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
  }) as unknown as typeof window.matchMedia;
}

async function launchDesigner() {
  stubViewport();
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

function photoSrcs(step: HTMLElement): string[] {
  return within(step).getAllByTestId("fresh-room-door-style-option")
    .map((option) => option.querySelector("img")?.getAttribute("src") ?? "");
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
});
afterEach(cleanup);

describe("designer start shows catalog door sample photos", () => {
  it("opens the photo grid for the first catalog vendor, then another vendor's photos", { timeout: 60_000 }, async () => {
    await launchDesigner();
    const step = await screen.findByTestId("fresh-room-catalog-setup");
    await screen.findByLabelText("White Shaker door thumbnail");
    expect(step.getAttribute("data-purpose")).toBe("catalog");
    expect(step.textContent).toContain("Choose the cabinet vendor, then the door style/color. Your design uses these cabinets.");
    expect(step.textContent).not.toMatch(/Auto-Design/);
    expect(step.textContent).not.toContain("Your room is ready");
    expect(step.textContent).not.toContain("Choose a distributor first");
    expect(within(step).getByRole("combobox", { name: "Choose cabinet distributor" }).textContent).toContain("Line One");
    expect(photoSrcs(step).sort()).toEqual([
      "https://cdn.example.test/espresso-shaker-door.jpg",
      WHITE_DOOR,
    ].sort());

    fireEvent.keyDown(within(step).getByRole("combobox", { name: "Choose cabinet distributor" }), { key: "ArrowDown" });
    await act(async () => {});
    fireEvent.click(await screen.findByRole("option", { name: "Line Two" }));
    await act(async () => {});
    expect(photoSrcs(step)).toEqual([GRAY_DOOR]);

    fireEvent.click(within(step).getByLabelText("Gray Slab door thumbnail"));
    await act(async () => {});
    const preview = within(step).getByTestId("fresh-room-door-style-preview");
    expect(preview.textContent).toContain("Gray Slab");
    expect(preview.querySelector("img")?.getAttribute("src")).toBe(GRAY_DOOR);
    expect(within(step).getByText("Not now", { hidden: true })).toBeTruthy();
  });

  it("Auto-Design skips the vendor/color photo step when a door style is chosen and opens the measured questions", { timeout: 60_000 }, async () => {
    // Tom (owner voice, Nov 24 2026, 12:26-12:27 PM CT): no vendor/color or catalog selector in the Auto-Design flow.
    window.localStorage.setItem(
      "cabinet-dealz:designer-draft:v2:owner:visitor@example.com",
      JSON.stringify({
        v: 2, originScope: "owner", savedAt: Date.now(),
        room: { width: 132, depth: 108, ceilingHeight: 96 },
        placed: [], openings: [], styleId: 21,
      }),
    );
    await launchDesigner();
    fireEvent.click(screen.getAllByLabelText("Room layout")[0]);
    await act(async () => {});
    fireEvent.click(await screen.findByTestId("room-layout-popup-kitchen"));
    await act(async () => {});
    fireEvent.click(await screen.findByTestId("room-layout-popup-auto-design"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    expect(screen.queryByTestId("fresh-room-catalog-setup")).toBeNull();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
  });
});
