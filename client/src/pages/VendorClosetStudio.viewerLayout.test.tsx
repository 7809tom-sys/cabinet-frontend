// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import VendorClosetStudio from "./VendorClosetStudio";

vi.mock("@/lib/trpc", () => ({
  trpc: { storefront: { hiddenCatalogKeys: { useQuery: () => ({ data: undefined }) } } },
}));

/**
 * The mocked canvas reports the design it is asked to centre, so these tests can assert which tower
 * the viewer was told to frame — the scene's own centering is proven in the camera and scene tests.
 */
vi.mock("@/components/vendor/VendorClosetScene", () => ({
  VendorClosetScene: ({ design, selectedBay }: { design: { wall: string; bays: Array<{ id: string; widthIn: number }> }; selectedBay: number }) => (
    <div data-testid="mock-vendor-scene" data-wall={design.wall} data-selected-bay={selectedBay} data-tower-ids={design.bays.map((bay) => bay.id).join(",")} data-tower-widths={design.bays.map((bay) => bay.widthIn).join(",")}>3D scene</div>
  ),
}));

const scene = () => screen.getByTestId("mock-vendor-scene");
const dock = () => screen.getByTestId("vendor-tablet-options-dock");
const openParts = () => fireEvent.click(screen.getByTestId("vendor-toolbar-edit"));

/** Enters the studio through the guided flow with the given room, exactly like a real session. */
function enterStudio({ width, depth, height }: { width: number; depth: number; height: number }) {
  render(<VendorClosetStudio />);
  fireEvent.change(screen.getByTestId("guided-width"), { target: { value: String(width) } });
  fireEvent.change(screen.getByTestId("guided-depth"), { target: { value: String(depth) } });
  fireEvent.change(screen.getByTestId("guided-height"), { target: { value: String(height) } });
  fireEvent.click(screen.getByTestId("guided-next"));
  fireEvent.click(screen.getByTestId("guided-build"));
  fireEvent.click(screen.getByTestId("guided-tune"));
}

describe("Closet Studio viewer stays centered and at the top of the page", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
    vi.restoreAllMocks();
  });

  it("keeps the viewer as the first grid cell, ahead of the controls sidebar, so it is never pushed down", () => {
    enterStudio({ width: 120, depth: 108, height: 96 });
    const workspace = screen.getByTestId("vendor-workspace");
    const children = Array.from(workspace.children);
    const viewerIndex = children.findIndex((child) => child.tagName === "MAIN");
    const dockIndex = children.findIndex((child) => child.getAttribute("data-testid") === "vendor-tablet-options-dock");
    // Reading order, and therefore layout order, puts the drawing first and the controls after it.
    expect(viewerIndex).toBe(0);
    expect(dockIndex).toBeGreaterThan(viewerIndex);
    // Both live in one grid row, side by side, so the viewer can never be stacked below the controls.
    expect(children[viewerIndex].className).toContain("min-[1280px]:order-2");
    expect(children[dockIndex].className).toContain("min-[1280px]:order-1");
    expect(screen.getByTestId("vendor-scene-panel").className).toContain("flex-1");
  });

  it("re-centres on the new tower when a tower is added, with everything to its left shifted over", () => {
    // A blank draft keeps this about the add behaviour itself rather than the auto-build's layout.
    render(<VendorClosetStudio />);
    fireEvent.change(screen.getByTestId("guided-width"), { target: { value: "120" } });
    fireEvent.change(screen.getByTestId("guided-depth"), { target: { value: "108" } });
    fireEvent.click(screen.getByTestId("guided-start-blank"));
    openParts();
    const before = scene().getAttribute("data-tower-ids")!.split(",");
    expect(before).toHaveLength(1);
    expect(scene().getAttribute("data-selected-bay")).toBe("0");

    fireEvent.click(within(dock()).getByRole("button", { name: "Add" }));
    expect(scene().getAttribute("data-selected-bay")).toBe("1");
    const after = scene().getAttribute("data-tower-ids")!.split(",");
    // The original tower is still first, so it did not change sides; the new tower landed beside it.
    expect(after[0]).toBe(before[0]);
    expect(after).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toMatch(/Added Tower 2.*to its left kept their parts/i);

    // A third tower goes after the selected one again, staying in the middle of the run.
    fireEvent.click(within(dock()).getByRole("button", { name: "Add" }));
    expect(scene().getAttribute("data-selected-bay")).toBe("2");
    expect(scene().getAttribute("data-tower-ids")!.split(",")).toHaveLength(3);
  });

  it("keeps the viewer centered through Tom's exact pantry 7x9 to closet-split sequence", () => {
    render(<VendorClosetStudio />);
    // Pantry, 7 ft x 9 ft (84 in x 108 in).
    fireEvent.click(screen.getByTestId("guided-space-pantry"));
    fireEvent.change(screen.getByTestId("guided-width"), { target: { value: "84" } });
    fireEvent.change(screen.getByTestId("guided-depth"), { target: { value: "108" } });
    fireEvent.change(screen.getByTestId("guided-height"), { target: { value: "84" } });
    fireEvent.click(screen.getByTestId("guided-next"));
    fireEvent.click(screen.getByTestId("guided-build"));
    expect(scene().getAttribute("data-wall")).toBe("back");
    expect(scene().getAttribute("data-selected-bay")).toBe("0");
    expect(screen.getByTestId("vendor-workspace").children[0].tagName).toBe("MAIN");
    fireEvent.click(screen.getByTestId("guided-tune"));

    // Then back to the questions, switch the space to a closet and build the split.
    fireEvent.click(screen.getByTestId("vendor-change-answers"));
    fireEvent.click(screen.getByTestId("guided-back"));
    fireEvent.click(screen.getByTestId("guided-space-closet"));
    fireEvent.click(screen.getByTestId("guided-next"));
    fireEvent.click(screen.getByTestId("guided-build"));

    // Same wall, same selected tower, viewer still the first child of the workspace: nothing moved it.
    expect(scene().getAttribute("data-wall")).toBe("back");
    expect(scene().getAttribute("data-selected-bay")).toBe("0");
    const workspace = screen.getByTestId("vendor-workspace");
    expect(workspace.children[0].tagName).toBe("MAIN");
    expect(workspace.children[0].className).toContain("min-[1280px]:order-2");
    expect(screen.getByTestId("vendor-scene-panel").className).toContain("flex-1");
  });

  it("keeps the viewer centered after a room-size change and after switching walls", () => {
    enterStudio({ width: 120, depth: 108, height: 96 });
    const workspace = screen.getByTestId("vendor-workspace");
    const viewer = workspace.children[0];
    expect(viewer.tagName).toBe("MAIN");

    fireEvent.click(screen.getByRole("button", { name: "Room and wall settings" }));
    const width = within(screen.getByTestId("vendor-controls")).getByLabelText("Room width (in)");
    fireEvent.change(width, { target: { value: "150" } });
    expect(workspace.children[0]).toBe(viewer);

    // Switching walls re-renders the scene on the new wall but keeps the same viewer cell.
    const overview = screen.getByTestId("vendor-room-overview");
    fireEvent.click(within(overview).getByRole("button", { name: /^Left wall/ }));
    expect(scene().getAttribute("data-wall")).toBe("left");
    expect(scene().getAttribute("data-selected-bay")).toBe("0");
    expect(workspace.children[0]).toBe(viewer);
  });

  it("keeps the viewer centered after deleting a plan and starting over", () => {
    // A blank draft: the guided build now fills the back wall, so use the empty-tower entry.
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByTestId("guided-start-blank"));
    openParts();
    fireEvent.click(within(dock()).getByRole("button", { name: "Add" }));
    expect(scene().getAttribute("data-selected-bay")).toBe("1");

    fireEvent.click(screen.getByTestId("vendor-delete-plan"));
    fireEvent.click(screen.getByTestId("vendor-delete-plan-confirm"));
    expect(screen.getByTestId("guided-gate")).toBeTruthy();
    fireEvent.click(screen.getByTestId("guided-start-blank"));

    expect(screen.getByTestId("vendor-workspace").children[0].tagName).toBe("MAIN");
    expect(scene().getAttribute("data-selected-bay")).toBe("0");
    expect(scene().getAttribute("data-tower-ids")!.split(",")).toHaveLength(1);
  });

  it("puts the price summary in the viewer's top-right corner instead of a column beside it", () => {
    enterStudio({ width: 120, depth: 108, height: 96 });
    const blueprint = screen.getByTestId("vendor-blueprint-column");
    expect(blueprint.className).toContain("min-[1280px]:right-3");
    expect(blueprint.className).toContain("min-[1280px]:top-16");
    // It floats over the viewer panel, so the drawing keeps the full row width.
    expect(screen.getByTestId("vendor-workspace").className).not.toContain("_250px");
    const reference = within(blueprint).getByTestId("vendor-reference-panel");
    expect(reference.textContent).toMatch(/2022 List|Material reference/i);
  });

  it("never covers the Decor toggle that shares the view-tab row", () => {
    enterStudio({ width: 120, depth: 108, height: 96 });
    // The toggle lives in the tab strip; the price card must start below that row, not over it.
    expect(screen.getByTestId("vendor-decor-toggle")).toBeTruthy();
    const blueprint = screen.getByTestId("vendor-blueprint-column");
    expect(blueprint.className).toContain("min-[1280px]:top-16");
    expect(blueprint.className).not.toContain("min-[1280px]:top-3");
  });
});
