// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import VendorClosetStudio from "./VendorClosetStudio";

vi.mock("@/lib/trpc", () => ({
  trpc: { storefront: { hiddenCatalogKeys: { useQuery: () => ({ data: undefined }) } } },
}));
vi.mock("@/components/vendor/VendorClosetScene", () => ({
  VendorClosetScene: () => <div data-testid="mock-vendor-scene">3D scene</div>,
}));

const choose = (testId: string) => fireEvent.click(screen.getByTestId(testId));
const setSize = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

/** Walk the whole beginner flow with the given answers, then return at the built studio. */
function runGuidedFlow({ type = "guided-type-reach-in", mix = "guided-mix-balanced", longHang = "guided-long-hang-yes", drawers = "guided-drawers-some", shoes = "guided-shoes-some" } = {}) {
  choose(type);
  choose("guided-next");
  choose(mix);
  choose(longHang);
  choose(drawers);
  choose(shoes);
  choose("guided-build");
}

describe("Closet Studio guided flow", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
    vi.restoreAllMocks();
  });

  it("opens on step 1 of the simple flow, with a sized room already filled in", () => {
    render(<VendorClosetStudio />);
    const gate = screen.getByTestId("guided-gate");
    expect(gate.getAttribute("data-guided-step")).toBe("1");
    expect(screen.getByTestId("guided-step-room")).toBeTruthy();

    // Sensible defaults: a reach-in is selected and its typical size is pre-filled.
    expect(screen.getByTestId("guided-type-reach-in").getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByTestId("guided-width") as HTMLInputElement).value).toBe("78");
    expect((screen.getByTestId("guided-depth") as HTMLInputElement).value).toBe("30");
    expect((screen.getByTestId("guided-height") as HTMLInputElement).value).toBe("96");

    // Advanced controls are not on the start screen at all.
    expect(screen.queryByTestId("vendor-advanced-options")).toBeNull();
    expect(screen.queryByTestId("vendor-toolbar-edit")).toBeNull();
  });

  it("offers the existing room presets as one-tap quick picks", () => {
    render(<VendorClosetStudio />);
    const presets = screen.getByTestId("guided-presets");
    expect(within(presets).getByTestId("guided-preset-reach-in-72-24-bifold-60")).toBeTruthy();
    expect(within(presets).getByTestId("guided-preset-reach-in-84-30-bifold-72")).toBeTruthy();

    fireEvent.click(within(presets).getByTestId("guided-preset-reach-in-84-30-bifold-72"));
    expect((screen.getByTestId("guided-width") as HTMLInputElement).value).toBe("84");
    expect((screen.getByTestId("guided-depth") as HTMLInputElement).value).toBe("30");

    // Switching to a walk-in swaps in the walk-in presets and its default size.
    choose("guided-type-walk-in");
    expect(within(screen.getByTestId("guided-presets")).getByTestId("guided-preset-walk-in-84-108-door-30")).toBeTruthy();
    expect((screen.getByTestId("guided-width") as HTMLInputElement).value).toBe("120");
  });

  it("asks four plain-language questions on step 2 and never shows a SKU or part code", () => {
    render(<VendorClosetStudio />);
    choose("guided-next");

    expect(screen.getByTestId("guided-gate").getAttribute("data-guided-step")).toBe("2");
    const step = screen.getByTestId("guided-step-questions");
    expect(within(step).getByText(/More hanging, more shelves, or a bit of both\?/)).toBeTruthy();
    expect(within(step).getByText(/Do you need somewhere to hang long dresses or coats\?/)).toBeTruthy();
    expect(within(step).getByText(/How many drawers do you want\?/)).toBeTruthy();
    expect(within(step).getByText(/How much shoe storage\?/)).toBeTruthy();

    // Plain language only: no SKUs, no studio jargon.
    const text = step.textContent ?? "";
    expect(text).not.toMatch(/\bSKU\b/);
    expect(text).not.toMatch(/\b43\d{4}\b/);
    expect(text).not.toMatch(/\b(?:upright|cleat|bay|envelope|takeoff|mount|finish)\b/i);
  });

  it("blocks a nonsense room size with a plain error instead of building", () => {
    render(<VendorClosetStudio />);
    setSize("guided-width", "10");
    choose("guided-next");
    expect(screen.getByTestId("guided-error").textContent).toMatch(/36 to 240 inches/i);
    expect(screen.getByTestId("guided-gate").getAttribute("data-guided-step")).toBe("1");
  });

  it("builds the closet from the answers, then shows a plain-language summary with Change answers", () => {
    render(<VendorClosetStudio />);
    runGuidedFlow();

    // The studio is open with the drawing, and the summary is on top of it.
    expect(screen.getByTestId("vendor-closet-studio")).toBeTruthy();
    expect(screen.getByTestId("mock-vendor-scene")).toBeTruthy();
    const summary = screen.getByTestId("guided-summary");
    expect(summary.textContent).toMatch(/Here is your closet/);
    const lines = screen.getByTestId("guided-summary-lines").textContent ?? "";
    expect(lines).toMatch(/shelves? for folded clothes/i);
    expect(lines).toMatch(/drawers? for smaller things/i);
    expect(lines).toMatch(/shoe shel(f|ves)/i);
    expect(lines).not.toMatch(/\bSKU\b/);

    // Delete plan stays visible while the summary is up.
    expect(screen.getByTestId("vendor-delete-plan")).toBeTruthy();
  });

  it("returns to the questions from Change answers, and to step 1 from Back", () => {
    render(<VendorClosetStudio />);
    runGuidedFlow();

    fireEvent.click(screen.getByTestId("guided-change-answers"));
    expect(screen.getByTestId("guided-gate")).toBeTruthy();
    expect(screen.queryByTestId("vendor-closet-studio")).toBeNull();
    // It resumes on the questions step, not back at the room size.
    expect(screen.getByTestId("guided-gate").getAttribute("data-guided-step")).toBe("2");

    fireEvent.click(screen.getByTestId("guided-back"));
    expect(screen.getByTestId("guided-gate").getAttribute("data-guided-step")).toBe("1");
  });

  it("keeps advanced controls collapsed until More options is expanded", () => {
    render(<VendorClosetStudio />);
    runGuidedFlow();
    fireEvent.click(screen.getByTestId("guided-tune"));

    const more = screen.getByTestId("vendor-more-options-toggle");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("vendor-advanced-options")).toBeNull();

    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    const advanced = screen.getByTestId("vendor-advanced-options");
    for (const label of [/Towers, sizes and shelves/i, /Add a part yourself/i, /Plan a corner/i, /Exact room sizes/i]) {
      expect(within(advanced).getByRole("button", { name: label })).toBeTruthy();
    }

    fireEvent.click(more);
    expect(screen.queryByTestId("vendor-advanced-options")).toBeNull();
  });

  it("keeps Delete plan visible and reachable with advanced controls collapsed", () => {
    render(<VendorClosetStudio />);
    runGuidedFlow();
    fireEvent.click(screen.getByTestId("guided-tune"));

    expect(screen.getByTestId("vendor-more-options-toggle").getAttribute("aria-expanded")).toBe("false");
    const remove = screen.getByTestId("vendor-delete-plan");
    expect(remove.className).toContain("h-11");

    fireEvent.click(remove);
    const dialog = screen.getByTestId("vendor-delete-plan-dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete plan" }));
    expect(screen.getByTestId("guided-gate")).toBeTruthy();
  });

  it("places more drawers for 'lots' than for 'none' in the resulting design", () => {
    render(<VendorClosetStudio />);
    runGuidedFlow({ drawers: "guided-drawers-none", shoes: "guided-shoes-none" });
    expect(screen.getByTestId("guided-summary-lines").textContent).not.toMatch(/drawers? for smaller things/i);
    cleanup();

    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
    render(<VendorClosetStudio />);
    runGuidedFlow({ drawers: "guided-drawers-lots", shoes: "guided-shoes-lots" });
    expect(screen.getByTestId("guided-summary-lines").textContent).toMatch(/drawers? for smaller things/i);
  });

  it("gives every guided choice a big tap target", () => {
    render(<VendorClosetStudio />);
    for (const testId of ["guided-type-reach-in", "guided-type-walk-in", "guided-next"]) {
      expect(screen.getByTestId(testId).className).toMatch(/min-h-\[?(5[0-9]|6[0-9])/);
    }
    choose("guided-next");
    for (const testId of ["guided-mix-hanging", "guided-mix-balanced", "guided-long-hang-yes", "guided-drawers-lots", "guided-shoes-lots", "guided-build"]) {
      expect(screen.getByTestId(testId).className).toMatch(/min-h-\[?(5[0-9]|6[0-9])/);
    }
  });

  it("still reaches a kids' closet, which needs a child's age and height", () => {
    render(<VendorClosetStudio />);
    choose("guided-space-kids");
    expect(screen.getByTestId("vendor-mode-gate")).toBeTruthy();
    expect(screen.getByTestId("vendor-kids-step")).toBeTruthy();
    expect(screen.getByText(/How old is the child\?/)).toBeTruthy();

    // And back to the simple start from there.
    fireEvent.click(screen.getByTestId("vendor-back-to-guided"));
    expect(screen.getByTestId("guided-gate")).toBeTruthy();
  });

  it("keeps the existing blank-tower and saved-draft entry points", () => {
    render(<VendorClosetStudio />);
    expect(screen.getByTestId("guided-start-blank")).toBeTruthy();
    fireEvent.click(screen.getByTestId("guided-start-blank"));
    expect(screen.getByTestId("vendor-closet-studio")).toBeTruthy();
  });
});

describe("corner shelf option in the guided flow", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
    vi.restoreAllMocks();
  });

  it("never offers a corner shelf on a reach-in", () => {
    render(<VendorClosetStudio />);
    choose("guided-type-reach-in");
    choose("guided-next");
    expect(screen.queryByTestId("guided-corner-shelf")).toBeNull();
    // The two answer tiles are absent too, not just the heading.
    expect(screen.queryByTestId("guided-corner-shelf-yes")).toBeNull();
    expect(screen.queryByTestId("guided-corner-shelf-no")).toBeNull();
  });

  it("offers it on a walk-in and builds the real corner shelves when chosen", () => {
    render(<VendorClosetStudio />);
    choose("guided-type-walk-in");
    choose("guided-next");
    const question = screen.getByTestId("guided-corner-shelf");
    expect(within(question).getByText(/corner shelf/i)).toBeTruthy();
    // The copy states the sourced dimension rather than a generic corner.
    expect(question.textContent).toMatch(/29\.5 in shelf/);

    choose("guided-corner-shelf-yes");
    choose("guided-mix-balanced");
    choose("guided-long-hang-yes");
    choose("guided-drawers-some");
    choose("guided-shoes-some");
    choose("guided-build");

    const raw = window.localStorage.getItem("vendor-closet-studio:v1") ?? "";
    expect(raw).toMatch(/cornerShelves/);
    expect(raw).toMatch(/432556/);
  });

  it("does not add a corner shelf when the walk-in answer is no", () => {
    render(<VendorClosetStudio />);
    choose("guided-type-walk-in");
    choose("guided-next");
    choose("guided-corner-shelf-no");
    choose("guided-mix-balanced");
    choose("guided-long-hang-yes");
    choose("guided-drawers-some");
    choose("guided-shoes-some");
    choose("guided-build");

    const raw = window.localStorage.getItem("vendor-closet-studio:v1") ?? "";
    expect(raw).not.toMatch(/432556/);
  });
});
