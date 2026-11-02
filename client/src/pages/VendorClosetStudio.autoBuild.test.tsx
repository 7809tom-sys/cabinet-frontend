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

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Closet Studio kids' mode, room size, auto-build and wall views", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
    vi.restoreAllMocks();
  });

  it("offers four room modes in the intro grid", () => {
    render(<VendorClosetStudio />);
    const gate = screen.getByTestId("vendor-mode-gate");
    for (const name of [/Closet/, /Pantry/, /Mudroom/, /Kids' closet/, /Laundry room/]) expect(within(gate).getAllByRole("button", { name }).length).toBeGreaterThan(0);
    expect(within(gate).getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"))).toHaveLength(5);
    expect(screen.queryByTestId("vendor-kids-step")).toBeNull();
  });

  it("asks a kids' closet for age and height with inline errors, then builds the kids' starter closet", () => {
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: /Kids' closet/ }));
    expect(screen.getByText(/How old is the child\?/)).toBeTruthy();
    expect(screen.getByText(/How tall\?/)).toBeTruthy();
    expect(screen.getByText("Rod goes at about the child's height")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));
    expect(screen.getByText("Enter an age from 3 to 12.")).toBeTruthy();
    expect(screen.getByText("Enter a height from 30 to 66 in.")).toBeTruthy();
    expect(screen.queryByTestId("vendor-closet-studio")).toBeNull();
    type(/How old is the child\?/, "13");
    type(/How tall\?/, "40");
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));
    expect(screen.getByText("Enter an age from 3 to 12.")).toBeTruthy();

    type(/How old is the child\?/, "4");
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));
    expect(screen.getByTestId("vendor-closet-studio")).toBeTruthy();
    expect(screen.getByText("Kids' closet Studio")).toBeTruthy();
    const dock = screen.getByTestId("vendor-tablet-options-dock");
    expect(within(dock).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();
    const guidance = screen.getByTestId("vendor-kids-guidance");
    expect(guidance.textContent).toContain("Anchor every tall unit to studs.");
    expect(guidance.textContent).toContain("Tip restraint required on drawer units 27 in or taller");

    // Switching away keeps the design and drops only the kids' guidance.
    fireEvent.click(screen.getAllByRole("button", { name: "Closet" })[0]);
    expect(screen.queryByTestId("vendor-kids-guidance")).toBeNull();
    expect(within(screen.getByTestId("vendor-tablet-options-dock")).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Kids' closet" })[0]);
    expect(screen.getByTestId("vendor-kids-guidance")).toBeTruthy();
  });

  it("sends a design with no child on file to the age and height step when it is switched to kids", () => {
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Kids' closet" })[0]);
    expect(screen.getByTestId("vendor-mode-gate")).toBeTruthy();
    expect(screen.getByTestId("vendor-kids-step")).toBeTruthy();
    expect(screen.getByText(/replaces the parts in your current draft/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("vendor-closet-studio")).toBeTruthy();
  });

  it("validates the room size inline before building", () => {
    render(<VendorClosetStudio />);
    type(/^Width \(in\)/, "20");
    type(/^Depth \(in\)/, "500");
    type(/^Height \(in\)/, "60");
    fireEvent.click(screen.getByRole("button", { name: "Auto-build my closet" }));
    expect(screen.getByText("Enter a width from 36 to 240 in.")).toBeTruthy();
    expect(screen.getByText("Enter a depth from 24 to 240 in.")).toBeTruthy();
    expect(screen.getByText("Enter a height from 72 to 120 in.")).toBeTruthy();
    expect(screen.queryByTestId("vendor-closet-studio")).toBeNull();
  });

  it("auto-builds a walk-in, keeps one copy of the controls, and rebuilds and undoes only after confirming", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Auto-build my closet" }));
    expect(screen.getByTestId("vendor-closet-studio")).toBeTruthy();
    expect(screen.getAllByTestId("vendor-tablet-options-dock")).toHaveLength(1);
    const dock = screen.getByTestId("vendor-tablet-options-dock");
    expect(within(dock).getByRole("button", { name: "Select Tower 2" })).toBeTruthy();

    const card = screen.getByTestId("vendor-auto-build");
    for (const label of ["Rods", "Shelves", "Drawers", "Shoes"]) expect(within(card).getByRole("slider", { name: label })).toBeTruthy();
    fireEvent.change(within(card).getByRole("slider", { name: "Rods" }), { target: { value: "1" } });
    fireEvent.click(within(card).getByRole("button", { name: "Rebuild" }));
    expect(confirm).toHaveBeenCalledWith("Rebuild replaces your current parts. Continue?");
    expect(within(card).getByRole("button", { name: "Undo rebuild" })).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Undo rebuild" }));
    expect(within(card).queryByRole("button", { name: "Undo rebuild" })).toBeNull();

    confirm.mockReturnValue(false);
    fireEvent.click(within(card).getByRole("button", { name: "Rebuild" }));
    expect(within(card).queryByRole("button", { name: "Undo rebuild" })).toBeNull();
  });

  it("explains a room size that is smaller than what is already used instead of silently reverting", () => {
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Auto-build my closet" }));
    type(/Room width \(in\)/, "40");
    const error = screen.getByTestId("vendor-room-error");
    expect(error.textContent).toMatch(/Room width stays at 120 in/);
    expect(error.textContent).toMatch(/smaller than what is already used/i);
    type(/Room width \(in\)/, "130");
    expect(screen.queryByTestId("vendor-room-error")).toBeNull();
  });

  it("switches between 3D, wall elevations and the top view without remounting the 3D scene", () => {
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Auto-build my closet" }));
    const tabs = within(screen.getByTestId("vendor-view-tabs"));
    expect(tabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["3D", "Back", "Left", "Right", "Top"]);
    const scene = screen.getByTestId("mock-vendor-scene");
    expect(screen.getByTestId("vendor-scene-panel").className).toContain("flex-none");

    fireEvent.click(tabs.getByRole("tab", { name: "Back" }));
    expect(screen.getByTestId("closet-wall-elevation").getAttribute("data-wall")).toBe("back");
    expect(screen.getByTestId("closet-wall-elevation").textContent).toMatch(/\d+″ upright/);
    expect(screen.getByTestId("mock-vendor-scene")).toBe(scene);

    fireEvent.click(tabs.getByRole("tab", { name: "Left" }));
    expect(screen.getByTestId("closet-wall-elevation").getAttribute("data-wall")).toBe("left");
    fireEvent.click(tabs.getByRole("tab", { name: "Top" }));
    expect(screen.getByTestId("vendor-top-view")).toBeTruthy();
    expect(screen.queryByTestId("closet-wall-elevation")).toBeNull();
    fireEvent.click(tabs.getByRole("tab", { name: "3D" }));
    expect(screen.queryByTestId("vendor-top-view")).toBeNull();
    expect(screen.getByTestId("mock-vendor-scene")).toBe(scene);
  });
});
