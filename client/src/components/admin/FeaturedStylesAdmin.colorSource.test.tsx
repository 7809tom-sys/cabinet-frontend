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
    // Every color tool sits in one card, so an edit and its result are seen together.
    const panel = dialog.querySelector('[data-testid="door-color-panel"]')!;
    expect(panel).toBeTruthy();
    for (const id of ["door-color-source-selector", "door-color-source-resolved", "door-color-source-wizard-tools"]) {
      expect(panel.querySelectorAll(`[data-testid="${id}"]`).length, id).toBe(1);
    }
    expect(dialog.querySelectorAll('[data-testid="door-color-source-wizard-tools"]').length).toBe(1);
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

  it("Sherwin-Williams keeps one wheel set, in the always-visible WalzCraft wizard", () => {
    const dialog = openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    const wizard = dialog.querySelector('[data-testid="door-color-source-wizard-tools"]')!;
    expect(wizard.querySelector('[aria-label="Sherwin-Williams stain wheel"]')).toBeTruthy();
    const slot = dialog.querySelector('[data-testid="door-color-source-sherwin-picker"]')!;
    // The tile editor points at the one wheel set instead of mounting a second copy.
    expect(slot.querySelector('[aria-label="Sherwin-Williams stain wheel"]')).toBeNull();
    expect(slot.querySelector('[data-testid="door-color-source-sherwin-williams-confirm"]')).toBeTruthy();
  });

  it("keeps a Confirm beside the wheels even before the Sherwin-Williams tile is open", () => {
    openFirst();
    const wizardConfirm = screen.getByTestId("door-color-source-sherwin-confirm-wizard") as HTMLButtonElement;
    expect(wizardConfirm.disabled).toBe(true);
  });

  it("enables the wizard Confirm once a chip is applied", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    const wizardConfirm = screen.getByTestId("door-color-source-sherwin-confirm-wizard") as HTMLButtonElement;
    expect(wizardConfirm.disabled).toBe(true);
  });

  it("offers the door's pictures as a Best picture picker and marks the current one", () => {
    styles[0] = { ...styles[0], doorSampleImageUrl: "/uploads/classic-cream.jpg" };
    const dialog = openFirst();
    expect(dialog.querySelector('[data-testid="door-best-picture"]')).toBeTruthy();
    expect(dialog.querySelector('[data-testid="door-color-panel"]')!.contains(dialog.querySelector('[data-testid="door-best-picture"]')!)).toBe(true);
    const current = screen.getByTestId("door-best-picture-supplier");
    expect(current.getAttribute("data-state")).toBe("on");
  });

  it("shows where the resolved colour came from, not just the hex", () => {
    openFirst();
    expect(screen.getByTestId("door-color-source-resolved").textContent).toMatch(/Resolved colour: #[0-9a-f]{6}/);
  });

  it("Approved AI image with none accepted says so and keeps the supplier photo", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-approved-ai-image"));
    expect(screen.getByTestId("door-color-source-ai-missing")).toBeTruthy();
    expect(screen.getByTestId("door-color-source-open-ai-maker")).toBeTruthy();
    expect(stored()["1"].source).toBe("original-image");
  });

  it("reloads a saved paint brand and still loads an old Sherwin-Williams row", () => {
    styles[0] = {
      ...styles[0],
      doorColorSource: "hex",
      doorColorSourceValue: { kind: "paint-brand", brand: "Benjamin Moore", code: "OC-23", name: "Classic Gray", hex: "#b7b7ad" },
      doorColorSourceUpdatedAt: "2026-11-22T18:00:00.000Z",
    };
    openFirst();
    expect((screen.getByTestId("paint-brand-select") as HTMLSelectElement).value).toBe("Benjamin Moore");
    expect((screen.getByTestId("paint-brand-code") as HTMLInputElement).value).toBe("OC-23");
    expect((screen.getByTestId("paint-brand-name") as HTMLInputElement).value).toBe("Classic Gray");
    expect((screen.getByTestId("paint-brand-hex") as HTMLInputElement).value).toBe("#b7b7ad");
    cleanup();
    styles[0] = {
      ...firstStyle,
      doorColorSource: "sherwin-williams",
      doorColorSourceValue: { finish: "paint", code: "SW7008", label: "Alabaster", hex: "#edeae0", woodSpecies: null, grainDirection: "none", profileImageUrl: null },
      doorColorSourceUpdatedAt: "2026-11-22T18:00:00.000Z",
    };
    openFirst();
    expect(screen.getByTestId("door-color-source-sherwin-williams").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Sherwin-Williams · Alabaster · #edeae0/);
    expect(screen.queryByTestId("paint-brand-select")).toBeNull();
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

describe("Edit Door: a confirmed color pick is saved at once (fix/door-style-color-source-save)", () => {
  const calls: Record<string, unknown>[] = [];
  beforeEach(() => {
    calls.length = 0;
    pendingRef.mutate = (x) => calls.push(x as Record<string, unknown>);
  });
  afterEach(() => { pendingRef.mutate = () => {}; });

  it("sends nothing when the editor opens, even with a server-saved choice", () => {
    styles[0] = { ...styles[0], doorColorSource: "hex", doorColorSourceValue: { hex: "#224466" }, doorColorSourceUpdatedAt: "2026-11-12T19:00:00.000Z" };
    openFirst();
    expect(calls).toEqual([]);
  });

  it("Confirm on a Hex pick persists doorColorSourceSelection immediately, with no Save press", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    // Clicking the tile alone only parks the door on Original image locally: nothing is sent.
    expect(calls).toEqual([]);
    fireEvent.change(screen.getByTestId("door-color-source-hex-input"), { target: { value: "#224466" } });
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByTestId("door-color-source-hex-confirm"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 1, doorColorSourceSelection: { source: "hex", confirmed: true, hex: "#224466" } });
  });

  it("Confirm on a Sherwin-Williams chip persists the selection together with the wizard patch, once", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    fireEvent.change(screen.getByTestId("wizard-stain-code"), { target: { value: "MW230" } });
    fireEvent.click(screen.getByTestId("wizard-stain-code-apply"));
    fireEvent.change(screen.getByTestId("wizard-grain-select"), { target: { value: "TGW" } });
    fireEvent.click(screen.getByTestId("wizard-apply"));
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams-confirm"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      id: 1,
      renderHex: "#9a6e51",
      doorColorSourceSelection: { source: "sherwin-williams", confirmed: true, color: { code: "MW230", hex: "#9a6e51" } },
    });
  });

  it("clicking another tile never overwrites a saved choice until that tile is confirmed", () => {
    styles[0] = { ...styles[0], doorColorSource: "hex", doorColorSourceValue: { hex: "#224466" }, doorColorSourceUpdatedAt: "2026-11-12T19:00:00.000Z" };
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    expect(calls).toEqual([]);
  });

  it("Confirm on a paint brand saves the hex as the render color and keeps brand, code and name", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-paint-brand-open"));
    expect(calls).toEqual([]);
    fireEvent.change(screen.getByTestId("paint-brand-select"), { target: { value: "Sherwin-Williams" } });
    fireEvent.change(screen.getByTestId("paint-brand-code"), { target: { value: "SW 7012" } });
    fireEvent.change(screen.getByTestId("paint-brand-name"), { target: { value: "Alabaster" } });
    fireEvent.change(screen.getByTestId("paint-brand-hex"), { target: { value: "#F2F0EA" } });
    fireEvent.click(screen.getByTestId("door-color-source-paint-brand-confirm"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      id: 1,
      renderHex: "#f2f0ea",
      doorColorSourceSelection: {
        source: "hex",
        confirmed: true,
        kind: "paint-brand",
        brand: "Sherwin-Williams",
        code: "SW 7012",
        name: "Alabaster",
        hex: "#f2f0ea",
      },
    });
    expect(stored()["1"]).toMatchObject({
      source: "paint-brand",
      kind: "paint-brand",
      brand: "Sherwin-Williams",
      code: "SW 7012",
      name: "Alabaster",
      hex: "#f2f0ea",
    });
  });

  it("choosing the Original image tile saves that choice", () => {
    styles[0] = { ...styles[0], doorColorSource: "hex", doorColorSourceValue: { hex: "#224466" }, doorColorSourceUpdatedAt: "2026-11-12T19:00:00.000Z" };
    openFirst();
    fireEvent.click(screen.getByTestId("door-color-source-original-image"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 1, doorColorSourceSelection: { source: "original-image" } });
  });
});

describe("Edit Door: saved values show in their tiles and fields", () => {
  it("the Hex tile falls back to the saved renderHex when no hex source is chosen", () => {
    styles[0] = { ...styles[0], renderHex: "#eae5d6" };
    openFirst();
    expect(screen.getByTestId("door-color-source-hex-swatch").getAttribute("aria-label")).toBe("Hex #eae5d6");
    expect(screen.queryByTestId("door-color-source-hex-empty")).toBeNull();
  });

  it("the Hex tile stays empty when there is no saved renderHex", () => {
    styles[0] = { ...styles[0], renderHex: null };
    openFirst();
    expect(screen.getByTestId("door-color-source-hex-empty")).toBeTruthy();
  });

  it("the AI tile shows the saved official AI picture even with no accepted run", () => {
    styles[0] = { ...styles[0], approvedReferenceImageUrl: null, approvedVersionId: null, aiProfileImageUrl: "/uploads/gemini-door.png" };
    openFirst();
    const img = screen.getByTestId("door-color-source-approved-photo") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/uploads/gemini-door.png");
    expect(screen.queryByTestId("door-color-source-approved-ai-image-empty")).toBeNull();
  });

  it("the AI tile shows the saved Gemini picture over an older approved image (Nov 18 2026)", () => {
    styles[0] = { ...styles[0], approvedVersionId: 7, approvedReferenceImageUrl: "/uploads/accepted.png", aiProfileImageUrl: "/uploads/gemini-door.png" };
    openFirst();
    expect((screen.getByTestId("door-color-source-approved-photo") as HTMLImageElement).getAttribute("src")).toBe("/uploads/gemini-door.png");
  });

  it("the AI tile still shows an accepted run picture when there is no Gemini picture", () => {
    styles[0] = { ...styles[0], approvedVersionId: 7, approvedReferenceImageUrl: "/uploads/accepted.png", aiProfileImageUrl: null };
    openFirst();
    expect((screen.getByTestId("door-color-source-approved-photo") as HTMLImageElement).getAttribute("src")).toBe("/uploads/accepted.png");
  });

  it("the AI tile never shows a rendering-audit capture as the picture", () => {
    styles[0] = { ...styles[0], approvedVersionId: 7, approvedReferenceImageUrl: "/manus-storage/door-rendering-audit/style-1/run-9_ab12.png", aiProfileImageUrl: null };
    openFirst();
    expect(screen.queryByTestId("door-color-source-approved-photo")).toBeNull();
    expect(screen.getByTestId("door-color-source-approved-ai-image-empty")).toBeTruthy();
  });

  it("the AI tile stays empty with neither picture", () => {
    styles[0] = { ...styles[0], approvedReferenceImageUrl: null, approvedVersionId: null, aiProfileImageUrl: null };
    openFirst();
    expect(screen.queryByTestId("door-color-source-approved-photo")).toBeNull();
    expect(screen.getByTestId("door-color-source-approved-ai-image-empty")).toBeTruthy();
  });

  it("opens with the official AI profile text when the style has no saved profile description", () => {
    styles[0] = { ...styles[0], profileDescription: null, aiProfileText: "1) Style: shaker. 2) Frame: present." };
    const dialog = openFirst();
    const field = Array.from(dialog.querySelectorAll("textarea")).find((el) => (el as HTMLTextAreaElement).value.includes("1) Style: shaker")) as HTMLTextAreaElement | undefined;
    expect(field).toBeTruthy();
  });

  it("keeps the style's own profile description over the AI profile text", () => {
    styles[0] = { ...styles[0], profileDescription: "Saved description", aiProfileText: "AI description" };
    const dialog = openFirst();
    const values = Array.from(dialog.querySelectorAll("textarea")).map((el) => (el as HTMLTextAreaElement).value);
    expect(values).toContain("Saved description");
    expect(values).not.toContain("AI description");
  });
});
