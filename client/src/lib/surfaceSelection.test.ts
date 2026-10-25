import { describe, expect, it, beforeEach } from "vitest";
import {
  activeCountertopForScope,
  clearCountertopSurfaceScope,
  computeBoxes,
  saveSurfaceSelection,
  loadSurfaceSelection,
  clearSurfaceSelection,
  guessFlooringMaterialId,
  guessBacksplashMaterialId,
  guessCountertopMaterialId,
  activeThreeDSurface,
  normalizeFinalMaterialSelections,
  refreshVerifiedSurfaceSelections,
  setActiveThreeDSurface,
  setCountertopSurfaceForScope,
  SURFACE_SELECTION_KEY,
  type SurfaceSelection,
  type SurfacePick,
} from "./surfaceSelection";

const countertop = (id: number, name: string): SurfacePick => ({
  id,
  slug: `countertop-${id}`,
  name,
  category: "Quartz Slabs (Countertops)",
  sellPrice: 1000 + id,
});

describe("scoped countertop selections", () => {
  it("treats a legacy unscoped countertop as the material for both wall runs and the island", () => {
    const legacy = countertop(1, "Legacy Quartz");
    expect(activeCountertopForScope([legacy], "perimeter")?.id).toBe(1);
    expect(activeCountertopForScope([legacy], "island")?.id).toBe(1);
  });

  it("keeps the wall-run material when a different island countertop is selected", () => {
    const wall = countertop(1, "Wall Quartz");
    const island = countertop(2, "Island Granite");
    const next = setCountertopSurfaceForScope([wall], island, "island");
    expect(activeCountertopForScope(next, "perimeter")).toMatchObject({ id: 1, countertopScope: "perimeter" });
    expect(activeCountertopForScope(next, "island")).toMatchObject({ id: 2, countertopScope: "island" });
  });

	it("keeps an inherited island matched when the wall countertop changes", () => {
	  const next = setCountertopSurfaceForScope(
	    [countertop(1, "Original Shared Quartz")],
	    countertop(2, "New Shared Quartz"),
	    "perimeter",
	  );
	  expect(next).toHaveLength(1);
	  expect(activeCountertopForScope(next, "perimeter")).toMatchObject({ id: 2, countertopScope: "all" });
	  expect(activeCountertopForScope(next, "island")).toMatchObject({ id: 2, countertopScope: "all" });
	});

	it("keeps an explicitly different island countertop when the wall material changes", () => {
	  const next = setCountertopSurfaceForScope([
	    { ...countertop(1, "Old Wall Quartz"), countertopScope: "perimeter" },
	    { ...countertop(3, "Island Granite"), countertopScope: "island" },
	  ], countertop(2, "New Wall Quartz"), "perimeter");
	  expect(activeCountertopForScope(next, "perimeter")?.id).toBe(2);
	  expect(activeCountertopForScope(next, "island")?.id).toBe(3);
	});

  it("collapses matching wall and island products to one whole-design selection", () => {
    const wall = { ...countertop(1, "Shared Quartz"), countertopScope: "perimeter" as const };
    const island = { ...countertop(2, "Island Granite"), countertopScope: "island" as const };
    const next = setCountertopSurfaceForScope([wall, island], wall, "island");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 1, countertopScope: "all" });
  });

  it("returns the island to the wall material without removing the wall selection", () => {
    const next = clearCountertopSurfaceScope([
      { ...countertop(1, "Wall Quartz"), countertopScope: "perimeter" },
      { ...countertop(2, "Island Granite"), countertopScope: "island" },
    ], "island");
    expect(activeCountertopForScope(next, "perimeter")?.id).toBe(1);
    expect(activeCountertopForScope(next, "island")?.id).toBe(1);
  });
});

describe("active 3D surface choice", () => {
  const backsplash = (id: number, name: string, threeDActive?: boolean) => ({
    id,
    name,
    category: "Tile & Mosaic",
    threeDActive,
  });

  it("preserves legacy last-added display behavior until an owner makes an explicit 3D choice", () => {
    const surfaces = [backsplash(183, "Desert Clay"), backsplash(164, "Concord Square")];
    expect(activeThreeDSurface(surfaces)).toMatchObject({ id: 164, name: "Concord Square" });
  });

  it("makes an explicit 3D material choice without deleting the other selected quote products", () => {
    const surfaces = [backsplash(183, "Desert Clay"), backsplash(164, "Concord Square")];
    const next = setActiveThreeDSurface(surfaces, 183);
    expect(next).toHaveLength(2);
    expect(next).toEqual([
      expect.objectContaining({ id: 183, threeDActive: true }),
      expect.objectContaining({ id: 164, threeDActive: false }),
    ]);
    expect(activeThreeDSurface(next)).toMatchObject({ id: 183, name: "Desert Clay" });
  });
});

describe("final installed material selection", () => {
  it("keeps only the current flooring and explicitly active backsplash while preserving fixtures and scoped countertops", () => {
    const final = normalizeFinalMaterialSelections([
      { id: 11, name: "Prior Oak", category: "Flooring" },
      { id: 12, name: "Final Ash", category: "Flooring" },
      { id: 21, name: "Prior Subway", category: "Tile & Mosaic", threeDActive: false },
      { id: 22, name: "Final Mosaic", category: "Tile & Mosaic", threeDActive: true },
      { ...countertop(31, "Wall Quartz"), countertopScope: "perimeter" as const },
      { ...countertop(32, "Island Quartz"), countertopScope: "island" as const },
      { id: 41, name: "Sink", category: "Sinks & Faucets", subCategory: "Sinks" },
    ]);

    expect(final.map((surface) => surface.id)).toEqual([12, 22, 31, 32, 41]);
    expect(final.find((surface) => surface.id === 22)).toMatchObject({ threeDActive: true });
  });

  it("uses the latest legacy backsplash when no explicit active marker exists", () => {
    const final = normalizeFinalMaterialSelections([
      { id: 51, name: "Prior Tile", category: "Tile & Mosaic" },
      { id: 52, name: "Final Tile", category: "Tile & Mosaic" },
    ]);

    expect(final).toEqual([expect.objectContaining({ id: 52, threeDActive: true })]);
  });

  it("keeps an explicitly added flooring trim beside the final floor without treating trim as the room material", () => {
    const final = normalizeFinalMaterialSelections([
      { id: 61, name: "Aveline 20mil Vinyl Flooring", category: "Flooring", subCategory: "Planks & Flooring" },
      { id: 62, name: "Aveline 20mil Stair Nose", category: "Flooring", subCategory: "Moldings & Trim" },
    ]);

    expect(final.map((surface) => surface.id)).toEqual([61, 62]);
  });
});

describe("verified saved surface refresh", () => {
  const savedFloor = {
    id: 82,
    name: "Old flooring name",
    category: "Flooring",
    sellPrice: 1,
    materialImageUrl: "/old-floor.webp",
    coverageSqFt: 12,
  };

  it("replaces stale saved surface price and material data with the verified live record", () => {
    const refreshed = refreshVerifiedSurfaceSelections([savedFloor], [{
      id: 82,
      pelicanCode: "BAHIA-12MIL",
      name: "Bahia 12mil Vinyl Flooring",
      category: "Flooring",
      subCategory: "Planks & Flooring",
      size: '7" x 48"',
      materialImageUrl: "/bahia-approved.webp",
      coverageSqFt: "23.5",
      sellPrice: 74.25,
    }]);

    expect(refreshed).toEqual([expect.objectContaining({
      id: 82,
      pelicanCode: "BAHIA-12MIL",
      name: "Bahia 12mil Vinyl Flooring",
      materialImageUrl: "/bahia-approved.webp",
      coverageSqFt: 23.5,
      sellPrice: 74.25,
    })]);
  });

  it("hydrates the reported saved Bahia floor and active Desert Clay backsplash from verified material-only records", () => {
    const refreshed = refreshVerifiedSurfaceSelections([
      {
        id: 82,
        slug: "bahia-12mil-vinyl-flooring",
        name: "Bahia 12mil Vinyl Flooring",
        category: "Flooring",
        subCategory: "Planks & Flooring",
        size: null,
        imageUrl: "/manus-storage/pelican/82_a8c67515.png",
        sellPrice: 74.25,
      },
      {
        id: 183,
        slug: "desert-clay",
        name: "Desert Clay",
        category: "Tile & Mosaic",
        subCategory: "Mosaic",
        size: "11.81 x 11.81 x 8",
        imageUrl: "/manus-storage/pelican/183_55da5bcf.png",
        sellPrice: 22.89,
        threeDActive: true,
      },
    ], [
      {
        id: 82,
        pelicanCode: "Bahia 12mil Vinyl Flooring",
        name: "Bahia 12mil Vinyl Flooring",
        category: "Flooring",
        subCategory: "Planks & Flooring",
        size: null,
        materialImageUrl: "/manus-storage/bahia_12mil_7x48_staggered_floor_551c6d5b.webp",
        coverageSqFt: null,
        sellPrice: 74.25,
      },
      {
        id: 183,
        pelicanCode: "Desert Clay",
        name: "Desert Clay",
        category: "Tile & Mosaic",
        subCategory: "Mosaic",
        size: "11.81 x 11.81 x 8",
        materialImageUrl: "/manus-storage/desert_clay_11_81_interlocking_mosaic_0aa381c4.webp",
        coverageSqFt: "7.75",
        sellPrice: 22.89,
      },
    ]);

    expect(refreshed).toEqual([
      expect.objectContaining({
        id: 82,
        materialImageUrl: "/manus-storage/bahia_12mil_7x48_staggered_floor_551c6d5b.webp",
      }),
      expect.objectContaining({
        id: 183,
        threeDActive: true,
        materialImageUrl: "/manus-storage/desert_clay_11_81_interlocking_mosaic_0aa381c4.webp",
        coverageSqFt: 7.75,
      }),
    ]);
  });

  it("keeps an unavailable saved product visible as a selection but clears its stale purchase price and 3D swatch", () => {
    expect(refreshVerifiedSurfaceSelections([savedFloor], [])).toEqual([
      expect.objectContaining({ id: 82, sellPrice: null, materialImageUrl: null }),
    ]);
  });

  it("preserves an already current selection reference across a query refetch", () => {
    const current = { ...savedFloor, sellPrice: 74.25, materialImageUrl: "/bahia-approved.webp", pelicanCode: "BAHIA-12MIL", subCategory: "Planks & Flooring", size: '7" x 48"', coverageSqFt: 23.5, name: "Bahia 12mil Vinyl Flooring" };
    const refreshed = refreshVerifiedSurfaceSelections([current], [{
      id: 82,
      pelicanCode: "BAHIA-12MIL",
      name: "Bahia 12mil Vinyl Flooring",
      category: "Flooring",
      subCategory: "Planks & Flooring",
      size: '7" x 48"',
      materialImageUrl: "/bahia-approved.webp",
      coverageSqFt: "23.5",
      sellPrice: 74.25,
    }]);
    expect(refreshed[0]).toBe(current);
  });

  it("refreshes an explicitly selected trim price without giving it a flooring material swatch", () => {
    const [refreshed] = refreshVerifiedSurfaceSelections([{
      id: 63,
      name: "Old Aveline Stair Nose",
      category: "Flooring",
      subCategory: "Moldings & Trim",
      sellPrice: 1,
      materialImageUrl: "/stale.webp",
    }], [{
      id: 63,
      pelicanCode: "Aveline 20mil Stair Nose",
      name: "Aveline 20mil Stair Nose",
      category: "Flooring",
      subCategory: "Moldings & Trim",
      size: '94"',
      materialImageUrl: null,
      coverageSqFt: null,
      sellPrice: 19.5,
    }]);

    expect(refreshed).toMatchObject({ sellPrice: 19.5, materialImageUrl: null, subCategory: "Moldings & Trim" });
  });
});

// The repo runs vitest under the "node" environment (no DOM), so provide a
// minimal in-memory localStorage shim before the module reads/writes it.
if (typeof (globalThis as any).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("computeBoxes", () => {
  it("returns null when no area is entered", () => {
    expect(computeBoxes(null, 20, 0.1)).toBeNull();
    expect(computeBoxes(0, 20, 0.1)).toBeNull();
  });

  it("rounds up to whole boxes and applies the waste factor", () => {
    // 180 sqft * 1.1 = 198; /20 = 9.9 -> 10 boxes
    expect(computeBoxes(180, 20, 0.1)).toBe(10);
    // exact fit still rounds correctly: 200 * 1.0 / 20 = 10
    expect(computeBoxes(200, 20, 0)).toBe(10);
    // 201 * 1.0 / 20 = 10.05 -> 11
    expect(computeBoxes(201, 20, 0)).toBe(11);
  });

  it("guards against a zero/invalid per-box coverage", () => {
    expect(computeBoxes(50, 0, 0)).toBe(50); // falls back to 1 sqft/box
    expect(computeBoxes(50, undefined, undefined)).toBe(50);
  });
});

describe("surface selection persistence", () => {
  beforeEach(() => clearSurfaceSelection());

  const sample: SurfaceSelection = {
    v: 1,
    savedAt: 123,
    layout: "l-shape",
    previewUrl: null,
    picks: {
      flooring: {
        id: 51,
        slug: "astoria",
        name: "Astoria 20mil Vinyl Flooring",
        category: "Flooring",
        sellPrice: 74.25,
        boxes: 10,
      } as SurfacePick,
    },
  };

  it("round-trips through localStorage", () => {
    saveSurfaceSelection(sample);
    const raw = localStorage.getItem(SURFACE_SELECTION_KEY);
    expect(raw).toBeTruthy();
    const loaded = loadSurfaceSelection();
    expect(loaded?.picks.flooring?.id).toBe(51);
    expect(loaded?.picks.flooring?.boxes).toBe(10);
  });

  it("returns null after clearing", () => {
    saveSurfaceSelection(sample);
    clearSurfaceSelection();
    expect(loadSurfaceSelection()).toBeNull();
  });

  it("ignores corrupt payloads", () => {
    localStorage.setItem(SURFACE_SELECTION_KEY, "{not json");
    expect(loadSurfaceSelection()).toBeNull();
  });
});

describe("material mapping heuristics", () => {
  const mk = (name: string, category = "Flooring"): SurfacePick => ({
    id: 1,
    slug: "x",
    name,
    category,
    sellPrice: null,
  });

  it("maps flooring names to the closest design material", () => {
    expect(guessFlooringMaterialId(mk("Walnut Wide Plank"))).toBe("walnut-hardwood");
    expect(guessFlooringMaterialId(mk("Astoria 20mil Vinyl Flooring"))).toBe("luxury-vinyl");
    expect(guessFlooringMaterialId(mk("Gray Porcelain"))).toBe("gray-tile");
  });

  it("maps backsplash tile names", () => {
    expect(guessBacksplashMaterialId(mk("Moonstone Hex", "Tile & Mosaic"))).toBe("white-hex");
    expect(guessBacksplashMaterialId(mk("Carrara Subway", "Tile & Mosaic"))).toBe("white-subway");
  });

  it("maps countertop names", () => {
    expect(guessCountertopMaterialId(mk("Calacatta Oro", "Quartz Slabs (Countertops)"))).toBe(
      "carrara-marble"
    );
    expect(guessCountertopMaterialId(mk("Nocturne Black", "Quartz Slabs (Countertops)"))).toBe(
      "black-granite"
    );
    expect(guessCountertopMaterialId(mk("Apollo", "Quartz Slabs (Countertops)"))).toBe(
      "white-quartz"
    );
  });

  it("returns null for undefined picks", () => {
    expect(guessFlooringMaterialId(undefined)).toBeNull();
    expect(guessCountertopMaterialId(undefined)).toBeNull();
  });
});
