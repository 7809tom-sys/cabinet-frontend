// @vitest-environment jsdom
/** The door editor shows ONE door color source selector at the top of its color panel (Tom, Nov 12 2026). */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const styles: Record<string, unknown>[] = [
  { id: 1, ourName: "White Shaker", distributorName: null, supplierBrandName: "Faircrest", aliasName: null, isFeatured: true, featuredRank: 1, isActive: true, distributorId: 1, roomScenes: null, grainDirection: null, color: null, renderHex: null },
  { id: 2, ourName: "Fresh Sage", isFeatured: false, supplierBrandName: "Faircrest", featuredRank: 0, isActive: true, distributorId: 2 },
  { id: 4, ourName: "Hickory Shaker", isFeatured: true, featuredRank: 3, isActive: true, distributorId: 1, roomScenes: null, roomSceneImageUrl: null },
  { id: 5, ourName: "Torino Dark Wood", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 3, grainDirection: "horizontal" },
  { id: 3, ourName: "Natural Oak", isFeatured: true, featuredRank: 2, isActive: true, distributorId: 1 },
];
const pendingRef = vi.hoisted(() => ({ list: [] as unknown[], mutate: (() => {}) as (x: unknown) => void }));
vi.mock("@/lib/trpc", () => {
  const mut = () => ({ mutate: (x: unknown) => pendingRef.mutate(x), mutateAsync: vi.fn(), isPending: false });
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


afterEach(cleanup);
beforeEach(() => localStorage.clear());

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
    // The old render hex field moved into the selector; the photo pair is still there.
    expect(dialog.querySelector("#ed-render-hex")).toBeNull();
    expect(dialog.querySelectorAll('[data-testid="render-color-picker"]').length).toBe(1);
    // The WalzCraft wizard is kept (collapsed) rather than deleted.
    expect(dialog.querySelector('[data-testid="door-color-source-wizard-tools"]')).toBeTruthy();
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
});
