// @vitest-environment jsdom
/** The door editor shows ONE door color source selector at the top of its color panel (Tom, Nov 12 2026). */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const styles: Record<string, unknown>[] = [
  { id: 1, ourName: "White Shaker", distributorName: null, supplierBrandName: "Faircrest", aliasName: null, isFeatured: true, featuredRank: 1, isActive: true, distributorId: 1, roomScenes: null, grainDirection: null, color: null, renderHex: null },
  { id: 2, ourName: "Fresh Sage", isFeatured: false, supplierBrandName: "Faircrest", featuredRank: 0, isActive: true, distributorId: 2 },
  { id: 4, ourName: "Hickory Shaker", isFeatured: true, featuredRank: 3, isActive: true, distributorId: 1, roomScenes: null, roomSceneImageUrl: null },
  { id: 5, ourName: "Torino Dark Wood", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 3, grainDirection: "horizontal" },
  { id: 3, ourName: "Natural Oak", isFeatured: true, featuredRank: 2, isActive: true, distributorId: 1 },
];
const pendingRef = vi.hoisted(() => ({
  list: [] as unknown[],
  mutate: (() => {}) as (x: unknown) => void,
  mutateAsync: vi.fn(async (x: unknown) => x),
}));
vi.mock("@/lib/trpc", () => {
  const mut = () => ({ mutate: (x: unknown) => pendingRef.mutate(x), mutateAsync: pendingRef.mutateAsync, isPending: false });
  const q = (path: string) => () => ({ data: path.includes("listForAdmin") ? styles : path.includes("skuCounts") ? [] : path.includes("listDoorMeasurementSubmissions") ? pendingRef.list : undefined, isLoading: false });
  const make = (path: string): unknown => new Proxy(() => {}, {
    get: (_t, k: string) => {
      if (k === "useQuery") return q(path);
      if (k === "useMutation") return mut;
      if (k === "useUtils") return () => make("utils");
      if (k === "invalidate" || k === "fetch") return vi.fn();
      return make(`${path}.${k}`);
    },
    apply: () => make(path),
  });
  return { trpc: make("trpc") };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }) }));

import FeaturedStylesAdmin from "./FeaturedStylesAdmin";


const firstStyle = { ...styles[0] };
afterEach(() => {
  cleanup();
  styles[0] = { ...firstStyle };
});
beforeEach(() => {
  localStorage.clear();
  pendingRef.mutateAsync.mockClear();
  styles[0] = { ...firstStyle };
});

const STORE = "doorColorSourceSelection.v1";
const stored = () => JSON.parse(localStorage.getItem(STORE) ?? "{}");

function openFirst() {
  render(<FeaturedStylesAdmin />);
  fireEvent.click(screen.getAllByLabelText("Edit style")[0]);
  return screen.getByRole("dialog");
}

describe("Edit Door: one door color source selector", () => {
  it("sits above the render color panel, Original image selected by default", () => {
    const dialog = openFirst();
    const selector = dialog.querySelector('[data-testid="door-color-source-selector"]')!;
    const overrides = screen.getByText("Render color and door shape");
    expect(selector).toBeTruthy();
    expect(selector.compareDocumentPosition(overrides) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dialog.querySelectorAll('[data-testid="door-color-source-selector"]').length).toBe(1);
    expect(screen.getByTestId("door-color-source-original-image").getAttribute("aria-checked")).toBe("true");
    // The old render hex field moved into the selector, and the photo eyedropper
    // now lives under the Hex tile, so neither is in the panel by default.
    expect(dialog.querySelector("#ed-render-hex")).toBeNull();
    expect(dialog.querySelectorAll('[data-testid="render-color-picker"]').length).toBe(0);
    // The duplicate WalzCraft wizard <details> is gone; its pickers live in the tile editor.
    expect(dialog.querySelector('[data-testid="door-color-source-wizard-tools"]')).toBeNull();
  });

  it("Hex is stored only after Confirm, and becomes the render hex", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    expect(stored()["1"]).toEqual({ source: "original-image", chosenAt: expect.any(String) });
    fireEvent.change(screen.getByTestId("door-color-source-hex-input"), { target: { value: "#224466" } });
    expect(stored()["1"].source).toBe("original-image");
    fireEvent.click(screen.getByTestId("door-color-source-hex-confirm"));
    expect(stored()["1"]).toMatchObject({ source: "hex", confirmed: true, hex: "#224466" });
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Hex · #224466/);
  });

  it("Hex opens the eyedropper under the Hex tile, and only there", () => {
    const dialog = openFirst();
    expect(dialog.querySelectorAll('[data-testid="render-color-picker"]').length).toBe(0);
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    const slot = dialog.querySelector('[data-testid="door-color-source-hex-picker"]')!;
    expect(slot.querySelectorAll('[data-testid="render-color-picker"]').length).toBe(1);
    expect(slot.querySelector('[data-testid="edit-dialog-sample-photo"]')).toBeTruthy();
  });

  it("Sherwin-Williams shows the existing WalzCraft wheels underneath", () => {
    const dialog = openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    const slot = dialog.querySelector('[data-testid="door-color-source-sherwin-picker"]')!;
    expect(slot.querySelector('[aria-label="Sherwin-Williams stain wheel"]')).toBeTruthy();
    expect(dialog.querySelector('[data-testid="door-color-source-wizard-tools"]')).toBeNull();
  });

  it("Approved AI image with none accepted says so and keeps the supplier photo", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-approved-ai-image"));
    expect(screen.getByTestId("door-color-source-ai-missing")).toBeTruthy();
    expect(screen.getByTestId("door-color-source-open-ai-maker")).toBeTruthy();
    expect(stored()["1"].source).toBe("original-image");
  });

  it("hydrates the selector from server fields when localStorage is empty", () => {
    styles[0] = {
      ...styles[0],
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#224466" },
      doorColorSourceUpdatedAt: "2026-11-12T19:00:00.000Z",
    };
    const dialog = openFirst();
    expect(screen.getByTestId("door-color-source-hex").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Hex · #224466/);
    expect(stored()["1"]).toMatchObject({ source: "hex", confirmed: true, hex: "#224466" });
    expect(dialog.querySelector('[data-testid="door-color-source-selector"]')).toBeTruthy();
  });

  it("missing server fields do not crash and keep the current selector behavior", () => {
    // styles[0] has no doorColorSource* keys
    const dialog = openFirst();
    expect(screen.getByTestId("door-color-source-original-image").getAttribute("aria-checked")).toBe("true");
    expect(dialog.querySelector('[data-testid="door-color-source-selector"]')).toBeTruthy();
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    fireEvent.change(screen.getByTestId("door-color-source-hex-input"), { target: { value: "#224466" } });
    fireEvent.click(screen.getByTestId("door-color-source-hex-confirm"));
    expect(stored()["1"]).toMatchObject({ source: "hex", confirmed: true, hex: "#224466" });
  });

  it("Save Changes sends the confirmed selection on adminUpdateDoorStyle", async () => {
    vi.stubGlobal("open", vi.fn());
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    fireEvent.change(screen.getByTestId("door-color-source-hex-input"), { target: { value: "#224466" } });
    fireEvent.click(screen.getByTestId("door-color-source-hex-confirm"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(pendingRef.mutateAsync).toHaveBeenCalled());
    const payload = pendingRef.mutateAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.doorColorSourceSelection).toMatchObject({ source: "hex", confirmed: true, hex: "#224466" });
  });
});
