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

/**
 * Auto-Design opens from the Kitchen section of the "Start with a room layout"
 * popup wherever that popup is reachable from an existing plan: the toolbar
 * "Room layout" button on desktop, and More > Room layout on a tablet workspace
 * (1024px+). Below 1024px (phone, iPad portrait) the popup has no entry on an
 * existing plan, so the top-actions Auto-Design button stays as the only route.
 */
async function openLayoutPopup(width: number) {
  const toolbarButton = screen.queryAllByLabelText("Room layout").find((element) => visibleAt(element, width));
  if (toolbarButton) {
    fireEvent.click(toolbarButton);
  } else {
    fireEvent.click(screen.getByTestId("compact-workspace-more-trigger"));
    await act(async () => {});
    fireEvent.click(within(await screen.findByRole("dialog")).getByText("Room layout"));
  }
  await act(async () => {});
  return screen.findByTestId("room-layout-popup-picker");
}

/** The Auto-Design opener for this width: popup Kitchen button at 1024px+, top-actions button below. */
async function triggerAt(width: number): Promise<HTMLButtonElement> {
  if (width < 1024) {
    const button = screen.getByTestId("mobile-auto-design-auto-build");
    expect(visibleAt(button, width)).toBe(true);
    return button as HTMLButtonElement;
  }
  await openLayoutPopup(width);
  fireEvent.click(screen.getByTestId("room-layout-popup-kitchen"));
  await act(async () => {});
  return (await screen.findByTestId("room-layout-popup-auto-design")) as HTMLButtonElement;
}

function noteText(width: number): string {
  if (width < 1024) return screen.getByTestId("mobile-auto-design-controls").textContent ?? "";
  return screen.getByTestId("room-layout-popup-auto-design-wrap").textContent ?? "";
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/designer");
});

afterEach(cleanup);

/**
 * Choosing Auto-Design opens the vendor / door-style step first. The Continue
 * path into the measured build is covered by DesignTool.autoDesignVendorStep.test.tsx.
 */
async function expectAutoDesignVendorStep() {
  const step = await screen.findByTestId("fresh-room-catalog-setup");
  expect(step.getAttribute("data-purpose")).toBe("auto-design");
  expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
}

describe("Auto-Design after the toolbar cleanup, on phone, tablet, and desktop", () => {
  it("opens the popup collapsed and shows an enabled Auto-Design in Kitchen at 1280px", async () => {
    await renderDesigner(1280);
    await openLayoutPopup(1280);
    expect(screen.getByTestId("room-layout-popup-kitchen").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("room-layout-popup-auto-design")).toBeNull();
    fireEvent.click(screen.getByTestId("room-layout-popup-kitchen"));
    const trigger = (await screen.findByTestId("room-layout-popup-auto-design")) as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute("aria-label")).toBe("Auto-Design");
    expect(trigger.getAttribute("title")).toBe("Auto-Design a kitchen from four fixed fixture anchors");
  });

  it("keeps the Auto-Design trigger on the LEFT of the toolbar, before the view switch, at 1280px", async () => {
    await renderDesigner(1280);
    const trigger = screen.getByTestId("toolbar-auto-design-auto-build") as HTMLButtonElement;
    expect(visibleAt(trigger, 1280)).toBe(true);
    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute("aria-label")).toBe("Auto-Design");
    expect(trigger.getAttribute("title")).toBe("Auto-Design a kitchen from four fixed fixture anchors");
    const viewSwitch = screen.getByTestId("primary-floor-plan-3d-switch");
    // The room plan + door style live to the right; Auto-Design is the first action.
    expect(Boolean(trigger.compareDocumentPosition(viewSwitch) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  for (const width of [375, 768, 1280]) {
    it(`the old desktop toolbar button, desktop dishwasher picker, More-sheet row and 3D button are gone at ${width}px`, async () => {
      await renderDesigner(width);
      for (const id of ["admin-auto-design-auto-build", "dishwasher-side-control", "three-d-floating-auto-design", "more-sheet-auto-design"]) {
        expect(screen.queryByTestId(id), id).toBeNull();
      }
      if (width < 1024) {
        fireEvent.click(screen.getByTitle("More options"));
        await act(async () => {});
        await screen.findByRole("dialog");
        expect(screen.queryByTestId("more-sheet-auto-design")).toBeNull();
      }
    });

    it(`keeps the trigger ENABLED and shows the refrigerator anchor note at ${width}px`, async () => {
      seedDraft([refrigerator]);
      await renderDesigner(width);
      const trigger = await triggerAt(width);
      expect(trigger.disabled).toBe(false);
      expect(trigger.getAttribute("title")).toBe("Auto-Design a kitchen around your refrigerator");
      expect(noteText(width)).toContain(AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE);
    });

    it(`keeps a hand-placed cabinet blocking the trigger with the same visible reason at ${width}px`, async () => {
      seedDraft([baseCabinet]);
      await renderDesigner(width);
      const trigger = await triggerAt(width);
      expect(trigger.disabled).toBe(true);
      expect(trigger.getAttribute("title")).toBe("Start Auto-Design from an empty Designer");
      expect(noteText(width)).toContain(AUTO_DESIGN_EMPTY_PLAN_NOTE);
    });
  }

  it("below 1024px the Room layout popup has no entry on an existing plan, so the top-actions button must stay", async () => {
    await renderDesigner(768);
    expect(screen.queryAllByLabelText("Room layout").filter((element) => visibleAt(element, 768))).toHaveLength(0);
    fireEvent.click(screen.getByTitle("More options"));
    await act(async () => {});
    expect(within(await screen.findByRole("dialog")).queryByText("Room layout")).toBeNull();
    expect(visibleAt(screen.getByTestId("mobile-auto-design-auto-build"), 768)).toBe(true);
    // The tablet/desktop toolbar trigger is CSS-hidden at this width, so the
    // phone row is the only Auto-Design route.
    expect(visibleAt(screen.getByTestId("toolbar-auto-design-auto-build"), 768)).toBe(false);
  });

  it("the popup Auto-Design button closes the popup and opens the same measured-build dialog", async () => {
    await renderDesigner(1280);
    fireEvent.click(await triggerAt(1280));
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    // The vendor / door-style step comes first; Continue (covered with mocked
    // vendor lines in DesignTool.autoDesignVendorStep.test.tsx) opens the dialog.
    await expectAutoDesignVendorStep();
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
    const trigger = await triggerAt(1280);
    expect(expected.enabled).toBe(true);
    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute("title")).toBe("Auto-Design a kitchen from four fixed fixture anchors");

    fireEvent.click(trigger);
    await act(async () => {});
    await expectAutoDesignVendorStep();
  });

  it("opens from the phone top actions for a sink base alone", async () => {
    seedDraft([sinkBase]);
    await renderDesigner(375);

    const trigger = await triggerAt(375);
    expect(trigger.disabled).toBe(false);
    fireEvent.click(trigger);
    await act(async () => {});
    await expectAutoDesignVendorStep();
  });

  it("keeps the opener shut once the button is disabled by real cabinet work", async () => {
    seedDraft([sinkBase, baseCabinet]);
    await renderDesigner(1280);

    const trigger = await triggerAt(1280);
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    await act(async () => {});
    expect(screen.queryByTestId("auto-design-auto-build-dialog")).toBeNull();
  });

  it("opens for a refrigerator alone, matching the enabled button", async () => {
    seedDraft([refrigerator]);
    await renderDesigner(1280);

    const trigger = await triggerAt(1280);
    expect(trigger.disabled).toBe(false);
    fireEvent.click(trigger);
    await act(async () => {});
    await expectAutoDesignVendorStep();
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
      // "Sink base" also names the intake utility question (15-rule spec, rule 2).
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(wallPicker)).toBeTruthy();
      expect(screen.getByLabelText(`${label} center from selected wall start in inches`)).toBeTruthy();
    }
    expect(screen.getAllByRole("combobox", { name: /— place on wall/ })).toHaveLength(4);
  });
});
