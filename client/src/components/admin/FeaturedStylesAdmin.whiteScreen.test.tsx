// @vitest-environment jsdom
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

describe("Edit Door: after Save", () => {
  it("opens the bake window first, then switches to the Door Rendering Audit tab for that style", async () => {
    const order: string[] = [];
    const open = vi.spyOn(window, "open").mockImplementation(() => { order.push("bake"); return null; });
    const onTab = (e: Event) => order.push(`tab:${(e as CustomEvent).detail.tab}`);
    window.addEventListener("admin:select-tab", onTab);
    render(<FeaturedStylesAdmin />);
    fireEvent.click(screen.getAllByLabelText("Edit style")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await vi.waitFor(() => expect(order).toContain("tab:door-rendering-audit"));
    expect(order).toEqual(["bake", "tab:door-rendering-audit"]);
    const params = new URLSearchParams(window.location.search);
    expect(params.get("tab")).toBe("door-rendering-audit");
    expect(params.get("auditStyleId")).toBe("1");
    expect(params.get("auditSearch")).toBe("White Shaker");
    window.removeEventListener("admin:select-tab", onTab);
    open.mockRestore();
  });
});

describe("Vendor update badge", () => {
  it("shows only on affected styles and opens a current → vendor diff with Approve/Reject", () => {
    const calls: unknown[] = [];
    pendingRef.mutate = (x) => calls.push(x);
    pendingRef.list = [{ id: 9, vendorLineName: "Faircrest", vendorStyleCode: "WS", vendorStyleName: "White Shaker", appliesToStyleIds: [1, 3], measuredBy: "Ann", measuredOn: "2026-10-30", citation: "spec sheet p2", measurementData: { topRailWidth: 2.25, bottomRailWidth: 2.25, leftStileWidth: 2.25, rightStileWidth: 2.25, centerRailWidth: 3 }, submittedAt: new Date() }];
    render(<FeaturedStylesAdmin />);
    expect(screen.queryByText("Physical sample-door measurement review")).toBeNull();
    expect(screen.getAllByTestId("vendor-update-badge").length).toBe(2);
    fireEvent.click(screen.getAllByTestId("vendor-update-badge")[0]);
    const diff = screen.getByTestId("vendor-update-diff");
    expect(diff.querySelector('[data-testid="vendor-diff-topRailWidth"]')!.textContent).toMatch(/Top rail.*→2\.25″/);
    expect(diff.querySelector('[data-testid="vendor-diff-centerRailWidth"]')!.textContent).toMatch(/Center rail.*→3″/);
    expect(screen.getByTestId("vendor-update-applies").textContent).toContain("2 styles");
    expect((screen.getByTestId("vendor-update-approve") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("vendor-update-reject"));
    expect(calls[0]).toMatchObject({ id: 9, approve: false });
    pendingRef.list = [];
  });
});

describe("Edit Door: non-featured styles use the same editor with the full WalzCraft section", () => {
  const openEditFor = (name: string) => {
    for (const btn of screen.getAllByLabelText("Edit style")) {
      fireEvent.click(btn);
      if (screen.queryByRole("dialog")?.querySelector("h2")?.textContent?.includes(name)) return;
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    }
    throw new Error(`no edit dialog for ${name}`);
  };
  it("non-featured Fresh Sage shows match, sample+brochure, Approve fill, skin and glazing", () => {
    render(<FeaturedStylesAdmin />);
    openEditFor("Fresh Sage");
    expect(screen.getByTestId("edit-dialog-walzcraft-match")).toBeTruthy();
    expect(screen.getByTestId("sample-vs-brochure")).toBeTruthy();
    expect(screen.getByTestId("edit-dialog-brochure-photo")).toBeTruthy();
    expect(screen.getByTestId("walzcraft-approve-fill")).toBeTruthy();
    expect(screen.getByTestId("skin-needed")).toBeTruthy();
  });
  it("non-featured style without an automatic match shows the best candidate door (not a dropdown-only state), and the override still works", () => {
    render(<FeaturedStylesAdmin />);
    openEditFor("Torino Dark Wood");
    expect(screen.getByTestId("edit-dialog-walzcraft-match")).toBeTruthy();
    expect(screen.getByRole("dialog").querySelector('[data-testid="walzcraft-no-match"]')).toBeNull();
    expect(screen.getByRole("dialog").querySelector('[data-testid="walzcraft-candidate-note"]')).toBeTruthy();
    fireEvent.change(screen.getByTestId("walzcraft-manual-door"), { target: { value: "altaeuro-tdw" } });
    expect(screen.getByTestId("walzcraft-approve-fill")).toBeTruthy();
    expect(screen.getByTestId("edit-dialog-brochure-photo")).toBeTruthy();
    localStorage.clear();
  });
});

describe("Edit Door: WalzCraft loads on open for every style (featured or not)", () => {
  it("shows the WalzCraft match + inline door picker, and the edited door beside the sample door, for every style including non-featured", () => {
    render(<FeaturedStylesAdmin />);
    const n = screen.getAllByLabelText("Edit style").length;
    const seen: string[] = [];
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getAllByLabelText("Edit style")[i]);
      const dialog = screen.getByRole("dialog");
      const title = dialog.querySelector("h2")?.textContent ?? "";
      const name = styles.find((s) => title.includes(String(s.ourName)))?.ourName;
      if (name) seen.push(String(name));
      expect(dialog.querySelector('[data-testid="edit-dialog-walzcraft-match"]')).toBeTruthy();
      expect(dialog.querySelector('[data-testid="door-editor-walzcraft-audit"]')).toBeTruthy();
      expect(dialog.querySelector('[data-testid="walzcraft-door-picker-embedded"]')).toBeNull();
      expect(dialog.querySelector('[data-testid="color-family-gray"]')).toBeNull();
      const pair = dialog.querySelector('[data-testid="sample-vs-brochure"]')!;
      const kids = Array.from(pair.children).map((c) => c.getAttribute("data-testid"));
      expect(kids.slice(0, 2)).toEqual(["edit-dialog-edited-door", "edit-dialog-sample-photo"]);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    }
    expect(seen).toEqual(expect.arrayContaining(["Fresh Sage", "Torino Dark Wood"]));
  });
});
