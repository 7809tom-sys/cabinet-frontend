// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const styles: Record<string, unknown>[] = [
  { id: 1, ourName: "White Shaker", distributorName: null, aliasName: null, isFeatured: true, featuredRank: 1, isActive: true, distributorId: 1, roomScenes: null, grainDirection: null, color: null, renderHex: null },
  { id: 2, ourName: "Fresh Sage", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 2 },
  { id: 4, ourName: "Hickory Shaker", isFeatured: true, featuredRank: 3, isActive: true, distributorId: 1, roomScenes: null, roomSceneImageUrl: null },
  { id: 5, ourName: "Torino Dark Wood", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 3, grainDirection: "horizontal" },
  { id: 3, ourName: "Natural Oak", isFeatured: true, featuredRank: 2, isActive: true, distributorId: 1 },
];
vi.mock("@/lib/trpc", () => {
  const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  const q = (path: string) => () => ({ data: path.includes("listForAdmin") ? styles : path.includes("skuCounts") ? [] : undefined, isLoading: false });
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

const KEYS = ["walzcraftDoorMatchApprovals.v1", "walzcraftDoorSkin.v1", "walzcraftWoodGrainTileSets.v1", "walzcraftColorPatterns.v1", "walzcraftStyleGlazing.v1"];
afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("door styles admin does not white-screen", () => {
  it("renders with sparse door records", () => {
    render(<FeaturedStylesAdmin />);
    expect(screen.getAllByText(/White Shaker/).length).toBeGreaterThan(0);
  });
  it("renders with corrupt localStorage (null JSON)", () => {
    for (const k of KEYS) localStorage.setItem(k, "null");
    render(<FeaturedStylesAdmin />);
    expect(screen.getAllByText(/White Shaker/).length).toBeGreaterThan(0);
  });

  for (const corrupt of [false, true]) {
    it(`opens the edit dialog for every style (corrupt storage: ${corrupt})`, () => {
      if (corrupt) for (const k of KEYS) localStorage.setItem(k, "null");
      render(<FeaturedStylesAdmin />);
      const n = screen.getAllByLabelText("Edit style").length;
      for (let i = 0; i < n; i++) {
        fireEvent.click(screen.getAllByLabelText("Edit style")[i]);
        expect(screen.getByText("Render color and door shape")).toBeTruthy();
        fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      }
    });
  }
});

describe("Edit Door: Skin needed? checkbox", () => {
  it("toggles the size choice and the no-skin helper", () => {
    render(<FeaturedStylesAdmin />);
    fireEvent.click(screen.getAllByLabelText("Edit style")[0]);
    const box = screen.getByTestId("skin-needed") as HTMLInputElement;
    expect(screen.getByTestId("skin-none-helper").textContent).toBe("Exposed sides match the door color (no skin).");
    fireEvent.click(box);
    expect((screen.getByTestId("skin-needed") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("1/4 in")).toBeTruthy();
    expect(screen.getByText("3/4 in")).toBeTruthy();
    expect(screen.queryByTestId("skin-none-helper")).toBeNull();
    fireEvent.click(screen.getByTestId("skin-needed"));
    expect(screen.getByTestId("skin-none-helper")).toBeTruthy();
    expect(screen.queryByTestId("skin-size")).toBeNull();
  });
});

describe("Edit Door: one render-color picker", () => {
  it("has a single picker holding sample + brochure side by side, and no second swatch eyedropper", () => {
    render(<FeaturedStylesAdmin />);
    const n = screen.getAllByLabelText("Edit style").length;
    let sawBrochure = false;
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getAllByLabelText("Edit style")[i]);
      const dialog = screen.getByRole("dialog");
      expect(dialog.querySelectorAll('[data-testid="render-color-picker"]').length).toBe(1);
      expect(Array.from(dialog.querySelectorAll("button")).filter((b) => /^Eyedropper$/.test(b.textContent ?? "")).length).toBe(0);
      const pair = dialog.querySelector('[data-testid="sample-vs-brochure"]')!;
      if (pair.querySelector('[data-testid="edit-dialog-brochure-photo"]')) {
        sawBrochure = true;
        expect(pair.querySelector('[data-testid="edit-dialog-sample-photo"]')).toBeTruthy();
        expect(pair.className).toMatch(/flex-col/);
        expect(pair.className).toMatch(/sm:flex-row/);
      }
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    }
    expect(sawBrochure).toBe(true);
  });
});
