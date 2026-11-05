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

const DRAFT_KEY = "vendor-closet-studio:v1";
const STORE_DRAFT_KEY = `${DRAFT_KEY}:acme-store`;

const seedDraft = (key = DRAFT_KEY) => window.localStorage.setItem(key, JSON.stringify({
  version: 2, mode: "pantry", mount: "hanging", finish: "Slate Rift", wall: "back",
  wallWidthIn: 150, roomDepthIn: 108, roomHeightIn: 110,
  wallLayouts: {
    back: { wallId: "back", bays: [{ id: "bay-1", wallId: "back", widthIn: 24, items: [{ id: "shelf-1", wallId: "back", kind: "shelf", bottomIn: 38 }] }] },
    left: { wallId: "left", bays: [] }, right: { wallId: "right", bays: [] }, front: { wallId: "front", bays: [] },
  },
  bays: [{ id: "bay-1", wallId: "back", widthIn: 24, items: [{ id: "shelf-1", wallId: "back", kind: "shelf", bottomIn: 38 }] }],
}));

describe("Closet Studio delete plan", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/closet");
    vi.restoreAllMocks();
  });

  it("shows a destructive Delete plan button in the studio toolbar", () => {
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));

    const toolbar = screen.getByTestId("vendor-studio-toolbar");
    const button = within(toolbar).getByRole("button", { name: "Delete plan" });
    expect(button.textContent).toMatch(/Delete plan/);
    // Destructive styling: red border and red text, not the primary green action.
    expect(button.className).toContain("border-[#c25b48]");
    expect(button.className).toContain("text-[#9c3524]");
    expect(button.className).toContain("h-11");
    expect(screen.queryByTestId("vendor-delete-plan-dialog")).toBeNull();
  });

  it("asks for confirmation with the exact wording and dismisses on Cancel without changing the plan", () => {
    seedDraft();
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Continue my local draft" }));
    expect(screen.getByTestId("vendor-closet-studio")).toBeTruthy();

    fireEvent.click(screen.getByTestId("vendor-delete-plan"));
    const dialog = screen.getByTestId("vendor-delete-plan-dialog");
    expect(dialog.textContent).toContain("Delete this closet plan and start over? This can't be undone.");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Delete plan" })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("vendor-delete-plan-dialog")).toBeNull();
    // Cancel keeps the Studio open and the draft still saved.
    expect(screen.getByTestId("vendor-closet-studio")).toBeTruthy();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeTruthy();
    expect(window.localStorage.getItem(DRAFT_KEY)).toContain("Slate Rift");
    expect(screen.getByTestId("vendor-studio-toolbar").textContent).toMatch(/Slate Rift/);
  });

  it("clears the saved draft, resets the design, and returns to the start gate on confirm", () => {
    seedDraft();
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Continue my local draft" }));
    expect(screen.getByTestId("vendor-closet-studio").textContent).toMatch(/Pantry Studio/);

    fireEvent.click(screen.getByTestId("vendor-delete-plan"));
    fireEvent.click(within(screen.getByTestId("vendor-delete-plan-dialog")).getByRole("button", { name: "Delete plan" }));

    // Back at the intro gate, with no Studio mounted.
    expect(screen.getByTestId("vendor-mode-gate")).toBeTruthy();
    expect(screen.queryByTestId("vendor-closet-studio")).toBeNull();
    // The saved draft is gone and the in-memory design is back to the blank starter.
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /Auto-build my closet/ })).toBeTruthy();
    expect(screen.queryByText(/Continue my local draft/)).toBeNull();
    // Starting over builds from the Closet defaults again, not the deleted pantry.
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));
    expect(screen.getByTestId("vendor-studio-toolbar").textContent).toMatch(/Closet Studio/);
    expect(screen.getByTestId("vendor-studio-toolbar").textContent).toMatch(/Glacier White/);
  });

  it("clears only the current storefront's draft key and leaves other stores alone", () => {
    seedDraft(STORE_DRAFT_KEY);
    seedDraft(DRAFT_KEY);
    render(<VendorClosetStudio affiliateSlug="acme-store" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue my local draft" }));

    fireEvent.click(screen.getByTestId("vendor-delete-plan"));
    fireEvent.click(within(screen.getByTestId("vendor-delete-plan-dialog")).getByRole("button", { name: "Delete plan" }));

    expect(window.localStorage.getItem(STORE_DRAFT_KEY)).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeTruthy();
  });

  it("resets selection and panel state so the next session starts clean", () => {
    seedDraft();
    render(<VendorClosetStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Continue my local draft" }));

    fireEvent.click(screen.getByTestId("vendor-toolbar-edit"));
    expect(screen.getByTestId("vendor-tablet-options-dock").className).toContain("flex");
    fireEvent.click(screen.getByRole("button", { name: "Room and wall settings" }));
    expect(screen.getByTestId("vendor-controls").className).toContain("flex");

    fireEvent.click(screen.getByTestId("vendor-delete-plan"));
    fireEvent.click(within(screen.getByTestId("vendor-delete-plan-dialog")).getByRole("button", { name: "Delete plan" }));

    expect(screen.getByTestId("vendor-mode-gate")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start with one tower" }));
    // Panels are closed again and the design is the blank starter tower.
    expect(screen.getByTestId("vendor-tablet-options-dock").className).toContain("hidden");
    expect(screen.getByTestId("vendor-controls").className).toContain("hidden");
    expect(screen.getByTestId("vendor-toolbar-edit").getAttribute("aria-pressed")).toBe("false");
    expect(within(screen.getByTestId("vendor-room-overview")).getByRole("button", { name: /Back wall: filled, 25\.5 of 120 inches used/i })).toBeTruthy();
  });
});
