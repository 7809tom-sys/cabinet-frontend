// @vitest-environment jsdom
/**
 * Owner ask: once Auto-Design is chosen, the cabinet vendor list and the door
 * style/color open first, before the shopper moves on to the Auto-Design
 * questions and Build measured kitchen.
 *
 * Mounts the real Designer as a signed-out visitor with two mocked vendor lines
 * and proves, at phone, tablet and desktop widths, that every click on
 * Auto-Design opens the vendor / door-style step with the plan's current choice
 * preselected, that Cancel never opens Auto-Design, and that Continue opens it
 * with the chosen line feeding the build's cabinet pools.
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
    const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
  }) as unknown as typeof window.matchMedia;
}

function seedDraft(styleId: number | null) {
  window.localStorage.setItem(
    "cabinet-dealz:designer-draft:v2:owner:visitor@example.com",
    JSON.stringify({
      v: 2, originScope: "owner", savedAt: Date.now(),
      room: { width: 132, depth: 108, ceilingHeight: 96 },
      placed: [], openings: [],
      ...(styleId != null ? { styleId } : {}),
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

function autoDesignTrigger(width: number): HTMLButtonElement {
  const visible = [
    screen.queryByTestId("admin-auto-design-auto-build"),
    screen.queryByTestId("mobile-auto-design-auto-build"),
  ].find((element) => visibleAt(element, width));
  expect(visible, `an Auto-Design trigger must be visible at ${width}px`).toBeTruthy();
  return visible as HTMLButtonElement;
}

async function openStep(width: number) {
  const trigger = autoDesignTrigger(width);
  expect(trigger.disabled).toBe(false);
  fireEvent.click(trigger);
  await act(async () => {});
  const step = await screen.findByTestId("fresh-room-catalog-setup");
  expect(step.getAttribute("data-purpose")).toBe("auto-design");
  return step;
}

function continueButton(step: HTMLElement) {
  // By text: Radix Select can leave the dialog aria-hidden in jsdom after it closes.
  return within(step).getByText("Continue to Auto-Design").closest("button") as HTMLButtonElement;
}

function lastBasePoolInput(): { styleId?: number } | undefined {
  return lastBaseInput.current as { styleId?: number } | undefined;
}

async function flushTimers() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
  lastBaseInput.current = undefined;
});
afterEach(cleanup);

describe("Auto-Design asks for the vendor and door style/color first", () => {
  for (const width of [375, 768, 1024, 1280]) {
    it(`opens the vendor step with the current choice preselected, then Auto-Design, at ${width}px`, { timeout: 60_000 }, async () => {
      seedDraft(21);
      await renderDesigner(width);

      const step = await openStep(width);
      // Not the Auto-Design questions yet.
      expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
      // The vendor list and the door-style grid are both in the step.
      expect(within(step).getByRole("combobox", { name: "Choose cabinet distributor" }).textContent).toContain("Line Two");
      const options = within(step).getAllByTestId("fresh-room-door-style-option");
      const selected = options.filter((option) => option.getAttribute("aria-pressed") === "true");
      expect(selected).toHaveLength(1);
      expect(selected[0].textContent).toContain("Gray Slab");
      // Usable at every width: the dialog scrolls inside the viewport and the
      // door grid starts at two columns on a phone.
      expect(step.className).toContain("overflow-y-auto");
      expect(step.className).toContain("max-h-[min(92vh,900px)]");
      expect(options[0].parentElement?.className).toContain("grid-cols-2");
      expect(within(step).getByRole("button", { name: "Cancel" })).toBeTruthy();

      // One click to continue with the preselected line.
      const go = continueButton(step);
      expect(go.disabled).toBe(false);
      fireEvent.click(go);
      await flushTimers();
      expect(screen.queryByTestId("fresh-room-catalog-setup")).toBeNull();
      expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
      expect(lastBasePoolInput()?.styleId).toBe(21);
    });
  }

  it("Cancel closes the step without opening Auto-Design", { timeout: 60_000 }, async () => {
    seedDraft(21);
    await renderDesigner(1280);
    const step = await openStep(1280);
    expect(within(step).queryByRole("button", { name: "Not now" })).toBeNull();
    fireEvent.click(within(step).getByRole("button", { name: "Cancel" }));
    await flushTimers();
    expect(screen.queryByTestId("fresh-room-catalog-setup")).toBeNull();
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();

    // Escape is the same Cancel.
    const again = await openStep(1280);
    fireEvent.keyDown(again, { key: "Escape" });
    await flushTimers();
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
  });

  it("shows the step every time Auto-Design is chosen", { timeout: 60_000 }, async () => {
    seedDraft(21);
    await renderDesigner(1280);
    let step = await openStep(1280);
    fireEvent.click(continueButton(step));
    await flushTimers();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
    fireEvent.keyDown(screen.getByTestId("auto-design-auto-build-dialog"), { key: "Escape" });
    await flushTimers();
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();

    step = await openStep(1280);
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
    expect(continueButton(step).disabled).toBe(false);
  });

  it("builds with a vendor and door style chosen in the step", { timeout: 60_000 }, async () => {
    seedDraft(21);
    await renderDesigner(1280);
    const step = await openStep(1280);

    // Switching vendor clears the other line's door, so Continue waits for a new one.
    fireEvent.keyDown(within(step).getByRole("combobox", { name: "Choose cabinet distributor" }), { key: "ArrowDown" });
    await act(async () => {});
    fireEvent.click(await screen.findByRole("option", { name: "Line One" }));
    await act(async () => {});
    expect(continueButton(step).disabled).toBe(true);
    const names = within(step).getAllByTestId("fresh-room-door-style-option").map((option) => option.getAttribute("aria-label"));
    expect(names.sort()).toEqual(["Espresso Shaker door thumbnail", "White Shaker door thumbnail"]);

    fireEvent.click(within(step).getByLabelText("White Shaker door thumbnail"));
    await act(async () => {});
    expect(continueButton(step).disabled).toBe(false);
    fireEvent.click(continueButton(step));
    await flushTimers();
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
    expect(lastBasePoolInput()?.styleId).toBe(11);
  });

  it("waits for a vendor and door style on a plan that has none", { timeout: 60_000 }, async () => {
    seedDraft(null);
    await renderDesigner(375);
    const step = await openStep(375);
    expect(within(step).getByText("Choose a distributor first")).toBeTruthy();
    expect(continueButton(step).disabled).toBe(true);
  });
});
