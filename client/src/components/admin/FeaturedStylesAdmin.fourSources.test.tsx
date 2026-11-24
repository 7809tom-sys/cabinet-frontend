// @vitest-environment jsdom
/** Edit Door: four color sources side by side, with a check mark that picks the 3D source. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
const listingRef = vi.hoisted(() => ({ data: undefined as unknown, procedurePresent: true }));
const captured = vi.hoisted(() => ({ inputs: [] as unknown[] }));
vi.mock("@/lib/doorColorSourceCabinetSnapshots", () => ({
  snapshotCabinets: async (
    jobs: Array<{ key: string; input: unknown }>,
    _kind: string,
    onResult: (key: string, result: { url: string }) => void,
  ) => {
    for (const job of jobs) {
      captured.inputs.push(job.input);
      onResult(job.key, { url: "data:image/png;base64,QUJD" });
    }
  },
}));
vi.mock("@/lib/trpc", () => {
  const mut = () => ({ mutate: (x: unknown) => pendingRef.mutate(x), mutateAsync: pendingRef.mutateAsync, isPending: false });
  const q = (path: string) => () => ({
    data: path.includes("listForAdmin") ? styles
      : path.includes("listDoorColorSources") ? listingRef.data
      : path.includes("skuCounts") ? []
      : path.includes("listDoorMeasurementSubmissions") ? pendingRef.list
      : undefined,
    isLoading: false,
    refetch: async () => ({}),
  });
  const make = (path: string): unknown => new Proxy(() => {}, {
    get: (_t, k: string) => {
      // A backend without the new procedure: the property simply is not there.
      if (!listingRef.procedurePresent && path.endsWith("doorStyles") && k === "listDoorColorSources") return undefined;
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

const SW = { finish: "paint", code: "SW 7036", label: "Accessible Beige", hex: "#d1c7b7", woodSpecies: null, grainDirection: "none", profileImageUrl: null };
const firstStyle = { ...styles[0] };
const calls: Record<string, unknown>[] = [];

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  captured.inputs = [];
  listingRef.data = undefined;
  listingRef.procedurePresent = true;
  styles[0] = { ...firstStyle };
  pendingRef.mutate = (x) => calls.push(x as Record<string, unknown>);
});
afterEach(() => {
  cleanup();
  pendingRef.mutate = () => {};
  styles[0] = { ...firstStyle };
});

function openFirst() {
  render(<FeaturedStylesAdmin />);
  fireEvent.click(screen.getAllByLabelText("Edit style")[0]);
  return screen.getByRole("dialog");
}

describe("Edit Door: four color sources side by side", () => {
  it("shows all four slots filled at once when the sources table answers, Original checked by default", () => {
    styles[0] = { ...styles[0], doorSampleImageUrl: "/uploads/door.jpg", approvedVersionId: 5, approvedReferenceImageUrl: "/uploads/accepted.png" };
    listingRef.data = {
      available: true,
      activeSource: null,
      sources: [{ source: "sherwin-williams", value: SW }, { source: "hex", value: { hex: "#224466" } }],
    };
    openFirst();
    expect(screen.getByTestId("door-four-source-preview")).toBeTruthy();
    expect(screen.getByTestId("four-source-image-original-image").getAttribute("src")).toBe("/uploads/door.jpg");
    expect(screen.getByTestId("four-source-image-approved-ai-image").getAttribute("src")).toBe("/uploads/accepted.png");
    expect(screen.getByTestId("four-source-swatch-sherwin-williams")).toBeTruthy();
    expect(screen.getByTestId("four-source-swatch-hex").getAttribute("aria-label")).toBe("Hex #224466");
    expect(screen.getByTestId("four-source-check-original-image").getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByTestId("door-four-source-legacy-note")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("checking the hex slot saves that choice through the existing doorColorSourceSelection save", () => {
    listingRef.data = { available: true, sources: [{ source: "hex", value: { hex: "#224466" } }] };
    openFirst();
    fireEvent.click(screen.getByTestId("four-source-check-hex"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 1, doorColorSourceSelection: { source: "hex", confirmed: true, hex: "#224466" } });
    expect(screen.getByTestId("four-source-check-hex").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("four-source-check-original-image").getAttribute("aria-checked")).toBe("false");
    // The existing selector and the preview agree.
    expect(screen.getByTestId("door-color-source-hex").getAttribute("aria-checked")).toBe("true");
  });

  it("checking the Sherwin-Williams slot saves the saved chip", () => {
    listingRef.data = { available: true, sources: [{ source: "sherwin-williams", value: SW }] };
    openFirst();
    fireEvent.click(screen.getByTestId("four-source-check-sherwin-williams"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ doorColorSourceSelection: { source: "sherwin-williams", confirmed: true, color: { code: "SW 7036", hex: "#d1c7b7" } } });
  });

  it("checking Original saves the explicit Original choice over a saved hex", () => {
    styles[0] = { ...styles[0], doorColorSource: "hex", doorColorSourceValue: { hex: "#224466" }, doorColorSourceUpdatedAt: "2026-11-12T19:00:00.000Z" };
    openFirst();
    expect(screen.getByTestId("four-source-check-hex").getAttribute("aria-checked")).toBe("true");
    // The saved hex opens locked, so checking another slot needs an unlock first.
    fireEvent.click(screen.getByTestId("four-source-check-original-image"));
    expect(calls).toHaveLength(0);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByTestId("door-color-unlock"));
    fireEvent.click(screen.getByTestId("four-source-check-original-image"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ doorColorSourceSelection: { source: "original-image" } });
  });

  it("falls back gracefully when the backend has no sources procedure: only the slot in use is filled", () => {
    listingRef.procedurePresent = false;
    styles[0] = { ...styles[0], doorColorSource: "hex", doorColorSourceValue: { hex: "#224466" }, doorColorSourceUpdatedAt: "2026-11-12T19:00:00.000Z" };
    openFirst();
    expect(screen.getByTestId("door-four-source-legacy-note")).toBeTruthy();
    expect(screen.getByTestId("four-source-swatch-hex").getAttribute("aria-label")).toBe("Hex #224466");
    expect(screen.getByTestId("four-source-empty-sherwin-williams")).toBeTruthy();
    expect((screen.getByTestId("four-source-check-sherwin-williams") as HTMLButtonElement).disabled).toBe(true);
    // The rest of the editor is unaffected.
    expect(screen.getByTestId("door-color-source-selector")).toBeTruthy();
  });

  it("falls back the same way when the procedure exists but answers { available: false }", () => {
    listingRef.data = { available: false, activeSource: null, sources: [] };
    openFirst();
    expect(screen.getByTestId("door-four-source-legacy-note")).toBeTruthy();
    expect(screen.getByTestId("four-source-empty-hex")).toBeTruthy();
  });

  it("a saved Gemini picture (no accepted render) shows in its slot and can be checked; 3D then uses it", () => {
    styles[0] = { ...styles[0], approvedReferenceImageUrl: null, approvedVersionId: null, aiProfileImageUrl: "/uploads/gemini-door.png" };
    openFirst();
    expect(screen.getByTestId("four-source-image-approved-ai-image").getAttribute("src")).toBe("/uploads/gemini-door.png");
    expect((screen.getByTestId("four-source-check-approved-ai-image") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId("four-source-check-approved-ai-image"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 1, doorColorSourceSelection: { source: "approved-ai-image" } });
  });

  it("with no Gemini picture at all the AI slot cannot be checked and says why", () => {
    styles[0] = { ...styles[0], approvedReferenceImageUrl: null, approvedVersionId: null, aiProfileImageUrl: null };
    openFirst();
    expect((screen.getByTestId("four-source-check-approved-ai-image") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("four-source-reason-approved-ai-image").textContent).toMatch(/No Gemini picture/);
  });

  it("an empty Hex tile fills, checks and saves right there, with the render hex saved alongside", () => {
    openFirst();
    fireEvent.change(screen.getByTestId("four-source-hex-input"), { target: { value: "#224466" } });
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByTestId("four-source-hex-use"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 1, renderHex: "#224466", doorColorSourceSelection: { source: "hex", confirmed: true, hex: "#224466" } });
    expect(screen.getByTestId("four-source-check-hex").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("four-source-swatch-hex").getAttribute("aria-label")).toBe("Hex #224466");
  });

  it("checking a saved Sherwin-Williams chip also saves its hex as the render hex", () => {
    listingRef.data = { available: true, sources: [{ source: "sherwin-williams", value: SW }] };
    openFirst();
    fireEvent.click(screen.getByTestId("four-source-check-sherwin-williams"));
    expect(calls[0]).toMatchObject({ renderHex: "#d1c7b7", doorColorSourceSelection: { source: "sherwin-williams", color: { hex: "#d1c7b7" } } });
  });

  it("an empty Sherwin-Williams tile has a button that opens the one picker (the wizard) and starts the pick", () => {
    openFirst();
    fireEvent.click(screen.getByTestId("four-source-sherwin-pick"));
    expect(screen.getByTestId("door-color-source-sherwin-williams").getAttribute("aria-checked")).toBe("true");
    // Nothing is saved until a chip is confirmed.
    expect(calls).toEqual([]);
  });

  it("sends nothing on open, whatever the sources table holds", () => {
    listingRef.data = { available: true, activeSource: "hex", sources: [{ source: "hex", value: { hex: "#224466" }, isActive: true }] };
    openFirst();
    expect(calls).toEqual([]);
  });
});
