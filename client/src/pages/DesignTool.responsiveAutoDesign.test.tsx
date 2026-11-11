// @vitest-environment jsdom
/**
 * Auto-Design has to be the same feature on a phone, a tablet, and a desktop.
 * These tests render the real Designer at 375 / 768 / 1280 CSS px and check the
 * three surfaces (desktop toolbar, phone+tablet top actions, More sheet) agree on
 * the trigger, the dishwasher-side picker, the blocked note, and the enabled
 * state the shared `autoDesignControl` computes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DesignTool from "./DesignTool";
import { AutoDesignDialog } from "@/components/design/AutoDesignDialog";
import { autoDesignControlState, AUTO_DESIGN_EMPTY_PLAN_NOTE, AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE, type AutoDesignPlacedLike } from "@/lib/autoDesignAvailability";
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
    apply() {
      return proxy;
    },
  });
  return { router: proxy };
});

vi.mock("@/lib/trpc", () => ({ trpc: router }));
// A signed-in admin, used here only so EmailGate lets the mount straight
// through. Auto-Design is no longer admin-gated — the public-viewer case lives
// in `DesignTool.publicAutoDesign.test.tsx`.
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin", email: "admin@cabinetdealz.test", name: "Admin" },
    isAuthenticated: true,
    loading: false,
    logout: async () => {},
  }),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signOut: async () => ({}), getSession: async () => ({ data: { session: null } }) } } }));
// WebGL is unavailable under jsdom; the 3D canvas is not part of this contract.
vi.mock("@/components/design/InteractiveRoom3D", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, InteractiveRoom3D: () => <div data-testid="mock-3d" /> };
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };
const DISPLAY_TOKENS = new Set([
  "hidden", "block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "contents", "table",
]);

/**
 * jsdom applies no stylesheet, so read the Tailwind display utilities that decide
 * whether a control is on screen at this width. `hidden` plus `lg:inline-flex` and
 * friends is exactly how the Designer hides/shows responsive chrome.
 */
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

/** Visible means this element and every ancestor renders a box at this width. */
function visibleAt(element: Element | null, width: number): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (displayAt(node, width) === "hidden") return false;
  }
  return element != null;
}

const sinkBase: AutoDesignPlacedLike & Record<string, unknown> = {
  uid: "sink-base-1",
  cabinetId: 11,
  masterCode: "SB36",
  description: '36" Sink Base',
  category: "Base Cabinets",
  subCategory: "Sink Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 36,
  depth: 24,
  height: 34.5,
  wallId: "back",
  wallOffset: 24,
  rotation: 0,
  mountHeightIn: 0,
};

const baseCabinet: AutoDesignPlacedLike & Record<string, unknown> = {
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

const refrigerator: AutoDesignPlacedLike & Record<string, unknown> = {
  uid: "fridge-1",
  cabinetId: 13,
  masterCode: "FRIDGE-36",
  description: '36" Refrigerator',
  category: "Appliances",
  subCategory: "Refrigerator",
  placement: "appliance",
  applianceRole: "freestanding",
  x: 100,
  y: 0,
  width: 36,
  depth: 30,
  height: 70,
  wallId: "back",
  wallOffset: 124,
  rotation: 0,
  mountHeightIn: 0,
};

const DRAFT_KEY = "cabinet-dealz:designer-draft:v2:owner:admin@cabinetdealz.test";

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

/** A pushed Pelican sink persists through the same v2 draft the Designer restores. */
function seedDraft(placed: Array<Record<string, unknown>>) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
    v: 2,
    originScope: "owner",
    savedAt: Date.now(),
    placed,
  }));
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

/** The visible Auto-Design trigger for this width, from any of the three surfaces. */
function triggerAt(width: number): HTMLElement {
  const candidates = [
    screen.queryByTestId("admin-auto-design-auto-build"),
    screen.queryByTestId("mobile-auto-design-auto-build"),
  ];
  const visible = candidates.find((element) => visibleAt(element, width));
  expect(visible, `an Auto-Design trigger must be visible at ${width}px`).toBeTruthy();
  return visible as HTMLElement;
}

/** The visible dishwasher-side picker for this width, from any of the three surfaces. */
function dishwasherPickerAt(width: number): HTMLSelectElement {
  const candidates = [
    ...screen.queryAllByLabelText("Dishwasher side"),
  ].filter((element) => visibleAt(element, width));
  expect(candidates.length, `exactly one dishwasher-side picker at ${width}px`).toBe(1);
  return candidates[0] as HTMLSelectElement;
}

function noteAt(width: number): HTMLElement | null {
  const candidates = screen.queryAllByTestId(/auto-design-(refrigerator-anchor|blocked)-note/).filter((element) => visibleAt(element, width));
  if (candidates.length === 0) return null;
  expect(candidates.length).toBe(1);
  return candidates[0] as HTMLElement;
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
});

afterEach(cleanup);

describe("Auto-Design is identical on phone, tablet, and desktop", () => {
  for (const width of [375, 768, 1280]) {
    it(`exposes one trigger, one dishwasher-side picker, and an enabled plan-free state at ${width}px`, async () => {
      await renderDesigner(width);

      const trigger = triggerAt(width);
      expect((trigger as HTMLButtonElement).disabled).toBe(false);
      expect(trigger.getAttribute("aria-label")).toBe("Auto-Design");
      expect(trigger.getAttribute("title")).toBe("Auto-Design a kitchen from four fixed fixture anchors");

      const picker = dishwasherPickerAt(width);
      expect(picker.value).toBe("right");
      expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
        "Left of sink",
        "Right of sink",
        "No dishwasher",
      ]);

      // No refrigerator in the layout means no anchor note and no blocked note anywhere.
      expect(noteAt(width)).toBeNull();

      // The More-sheet row stays in place too; it lives inside a closed sheet
      // here and is exercised by its own test below.
    });

    it(`keeps the trigger ENABLED and explains the refrigerator as a fixed anchor at ${width}px`, async () => {
      seedDraft([refrigerator]);
      await renderDesigner(width);

      const expected = autoDesignControlState({
        audienceAllowed: true,
        layoutLocked: false,
        placedCount: 0,
        refrigeratorAnchor: true,
      });
      const trigger = triggerAt(width) as HTMLButtonElement;
      // The bug this pins: a placed refrigerator used to gray the control out.
      expect(expected.enabled).toBe(true);
      expect(trigger.disabled).toBe(false);
      expect(trigger.getAttribute("title")).toBe("Auto-Design a kitchen around your refrigerator");

      // The visible sentence names the refrigerator as the anchor the build
      // designs around; it is never a reason to stand down.
      const note = noteAt(width);
      expect(note, `the refrigerator anchor note must be visible at ${width}px`).toBeTruthy();
      expect(note!.textContent).toBe(AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE);
      expect(note!.textContent).not.toMatch(/isn't available/i);

      // The dishwasher-side choice stays available beside it.
      expect(dishwasherPickerAt(width).value).toBe("right");
    });

    it(`keeps a hand-placed cabinet blocking the trigger with the same visible reason at ${width}px`, async () => {
      seedDraft([baseCabinet]);
      await renderDesigner(width);

      const trigger = triggerAt(width) as HTMLButtonElement;
      expect(trigger.disabled).toBe(true);
      expect(trigger.getAttribute("title")).toBe("Start Auto-Design from an empty Designer");

      // The reason is on screen, not just in a title tooltip a phone cannot show.
      const note = noteAt(width);
      expect(note, `the empty-plan reason must be visible at ${width}px`).toBeTruthy();
      expect(note!.textContent).toBe(AUTO_DESIGN_EMPTY_PLAN_NOTE);
      expect(AUTO_DESIGN_EMPTY_PLAN_NOTE).not.toBe(AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE);
    });
  }

  it("keeps the phone and tablet trio on its own wrapping row so 375px cannot overflow sideways", async () => {
    await renderDesigner(375);

    const cluster = screen.getByTestId("mobile-designer-top-actions");
    expect(cluster.className).toContain("flex-wrap");
    expect(cluster.className).toContain("min-w-0");
    expect(cluster.className).toContain("max-w-full");
    expect(visibleAt(cluster, 375)).toBe(true);

    const controls = screen.getByTestId("mobile-auto-design-controls");
    expect(controls).toBe(cluster.querySelector('[data-testid="mobile-auto-design-controls"]'));
    expect(visibleAt(controls, 768)).toBe(true);
    expect(visibleAt(controls, 1280)).toBe(false);
    // A full-basis wrapping row with min-w-0/truncate controls cannot push the
    // toolbar wider than the viewport at 375px, and `md:basis-auto` lets the same
    // trio share the icon row once there is room at 768px.
    expect(controls.className).toContain("basis-full");
    expect(controls.className).toContain("md:basis-auto");
    expect(controls.className).toContain("min-w-0");
    expect(controls.className).toContain("flex-wrap");
    expect(controls.className).toContain("justify-end");
    expect(within(controls).getByTestId("mobile-auto-design-auto-build").className).toContain("min-w-0");
    const picker = within(controls).getByLabelText("Dishwasher side");
    expect(picker.className).toContain("max-w-");
    expect(screen.getByTestId("mobile-designer-top-actions").className).not.toContain("overflow-x-scroll");
  });

  it("keeps the desktop toolbar trio out of the phone and tablet toolbar", async () => {
    await renderDesigner(1280);
    expect(visibleAt(screen.getByTestId("admin-auto-design-auto-build"), 1280)).toBe(true);
    expect(visibleAt(screen.getByTestId("admin-auto-design-auto-build"), 1023)).toBe(false);
    expect(visibleAt(screen.getByTestId("mobile-auto-design-auto-build"), 1280)).toBe(false);
    expect(visibleAt(screen.getByTestId("mobile-auto-design-auto-build"), 375)).toBe(true);
  });

  it("still shows the More-sheet row and keeps it on the same gate", async () => {
    await renderDesigner(375);
    fireEvent.click(screen.getByTitle("More options"));
    await act(async () => {});
    const row = await screen.findByTestId("more-sheet-auto-design");
    expect((row as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("a pushed sink base opens Auto-Design whenever the button is enabled", () => {
  it("opens the dialog for a sink base alone, exactly as the button allows", async () => {
    seedDraft([sinkBase]);
    await renderDesigner(1280);

    const expected = autoDesignControlState({
      audienceAllowed: true,
      layoutLocked: false,
      placedCount: 0,
      refrigeratorAnchor: false,
    });
    const trigger = triggerAt(1280) as HTMLButtonElement;
    expect(expected.enabled).toBe(true);
    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute("title")).toBe("Auto-Design a kitchen from four fixed fixture anchors");

    fireEvent.click(trigger);
    await act(async () => {});
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
  });

  it("opens from the phone top actions for a sink base alone", async () => {
    seedDraft([sinkBase]);
    await renderDesigner(375);

    const trigger = triggerAt(375) as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    fireEvent.click(trigger);
    await act(async () => {});
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
  });

  it("keeps the opener shut once the button is disabled by real cabinet work", async () => {
    seedDraft([sinkBase, baseCabinet]);
    await renderDesigner(1280);

    const trigger = triggerAt(1280) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    await act(async () => {});
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
  });

  it("opens for a refrigerator alone, matching the enabled button", async () => {
    seedDraft([refrigerator]);
    await renderDesigner(1280);

    const trigger = triggerAt(1280) as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    fireEvent.click(trigger);
    await act(async () => {});
    expect(await screen.findByTestId("auto-design-auto-build-dialog")).toBeTruthy();
  });
});

describe("AutoDesignDialog keeps the four measured appliance anchor rows", () => {
  it("renders a wall picker and a center field for sink, stove, dishwasher, and refrigerator", () => {
    cleanup();
    render(<AutoDesignDialog open onOpenChange={vi.fn()} onBuild={() => ({ ok: true })} wallCount={6} />);

    for (const [label, wallPicker] of [
      ["Sink base", "Sink base — place on wall"],
      ["Range / stove", "Range / stove — place on wall"],
      ["Dishwasher — Optional exact dishwasher center", "Dishwasher — place on wall when using an exact center"],
      ["Refrigerator", "Refrigerator — place on wall"],
    ] as const) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByLabelText(wallPicker)).toBeTruthy();
      expect(screen.getByLabelText(`${label} center from selected wall start in inches`)).toBeTruthy();
    }
    expect(screen.getAllByRole("combobox", { name: /— place on wall/ })).toHaveLength(4);
  });
});
