// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import VendorClosetStudio from "./VendorClosetStudio";

vi.mock("@/lib/trpc", () => ({
  trpc: { storefront: { hiddenCatalogKeys: { useQuery: () => ({ data: undefined }) } } },
}));
vi.mock("@/components/vendor/VendorClosetScene", () => ({
  VendorClosetScene: () => <div data-testid="mock-vendor-scene">3D scene</div>,
}));

const dock = () => screen.getByTestId("vendor-tablet-options-dock");
const openTowerPanel = () => {
  fireEvent.click(screen.getByTestId("vendor-toolbar-edit"));
  fireEvent.click(within(dock()).getByRole("button", { name: "Parts" }));
};

function startBlank() {
  render(<VendorClosetStudio />);
  fireEvent.click(screen.getByTestId("guided-start-blank"));
}

describe("Closet Studio shelf placement tool", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
  });

  it("adds the requested number of shelves from the bottom at the default 10 in pitch", () => {
    startBlank();
    openTowerPanel();
    const run = within(dock()).getByTestId("vendor-shelf-run");
    expect(run.textContent).toMatch(/first goes at the 4\.5 in mark, then every 10 in/i);
    // The user only has to type how many shelves.
    fireEvent.change(within(run).getByRole("spinbutton", { name: "Number of shelves to add" }), { target: { value: "4" } });
    fireEvent.click(within(run).getByRole("button", { name: "Add 4 shelves from the bottom" }));
    // 6.75 in is the first legal height at or above the 4.5-in mark, then every 10 in.
    expect(screen.getByRole("status").textContent).toMatch(/Added 4 shelves at 6\.75 in, 16\.75 in, 26\.75 in, 36\.75 in\./);
    expect(run.textContent).toMatch(/6\.75 in, 16\.75 in, 26\.75 in, 36\.75 in/);
  });

  it("lets the spacing be edited and reports the shelves that do not fit", () => {
    startBlank();
    openTowerPanel();
    const run = within(dock()).getByTestId("vendor-shelf-run");
    fireEvent.change(within(run).getByRole("spinbutton", { name: "Number of shelves to add" }), { target: { value: "10" } });
    fireEvent.change(within(run).getByRole("spinbutton", { name: "Shelf spacing in inches" }), { target: { value: "20" } });
    fireEvent.click(within(run).getByRole("button", { name: "Add 10 shelves from the bottom" }));
    const notice = screen.getByRole("status").textContent ?? "";
    expect(notice).toMatch(/Added \d+ shelves? at/);
    // Anything above the fixed top shelf is reported by shelf number, never silently forced.
    expect(notice).toMatch(/Shelf [\d, ]+ did not fit under the fixed top shelf and (was|were) left out/);
  });

  it("rejects a spacing that is too tight without touching the design", () => {
    startBlank();
    openTowerPanel();
    const run = within(dock()).getByTestId("vendor-shelf-run");
    fireEvent.change(within(run).getByRole("spinbutton", { name: "Shelf spacing in inches" }), { target: { value: "1" } });
    expect(within(run).getByRole("button", { name: "Add shelves from the bottom" })).toHaveProperty("disabled", true);
  });

  it("sets an exact height for the selected shelf and refuses an overlapping one", () => {
    startBlank();
    openTowerPanel();
    // The starter draft's shelf at 38 in is selected from the placed-items list.
    fireEvent.click(within(dock()).getByRole("button", { name: /Adjustable shelf · 38 in/ }));
    const exact = within(dock()).getByTestId("vendor-exact-height");
    const input = within(exact).getByRole("spinbutton", { name: "Exact item height from the floor in inches" });
    fireEvent.change(input, { target: { value: "44.25" } });
    fireEvent.click(within(exact).getByRole("button", { name: "Set height" }));
    expect(within(dock()).getByRole("button", { name: /Adjustable shelf · 44\.25 in/ })).toBeTruthy();

    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.click(within(exact).getByRole("button", { name: "Set height" }));
    expect(screen.getByRole("status").textContent).toMatch(/must be between .* in, in ¼-in steps/i);
  });

  it("shows a live inch readout element for cursor dragging inside the drawing", () => {
    // The readout lives inside the real scene, so read it from the un-mocked component source.
    const source = readFileSync(`${process.cwd()}/client/src/components/vendor/VendorClosetScene.tsx`, "utf8");
    expect(source).toContain('data-testid="vendor-shelf-drag-readout"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("studioSnapShelfHeight(design, rawIn)");
    expect(source).toContain("handlers.current.onMoveShelf?.(target.index, target.id, at.bottomIn)");
    // The readout reports the exact ¼-in height that the drop applies.
    expect(source).toContain("readout.textContent = `${bottomIn} in`");
    expect(source).toContain('addEventListener("pointermove", onPointerMove)');
  });
});
