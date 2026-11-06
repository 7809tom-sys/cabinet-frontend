import { describe, it, expect } from "vitest";
import { buildSurfaceCartLines, type SurfacePick } from "./surfaceCartLines";

const faucet: SurfacePick = {
  id: 101,
  name: "Brushed Nickel Pull-Down Faucet",
  category: "Sinks & Faucets",
  size: null,
  sellPrice: 189.0,
};
const floor: SurfacePick = {
  id: 202,
  name: "Natural Oak Luxury Vinyl Plank",
  category: "Flooring",
  size: '7" x 48"',
  sellPrice: 2.49,
};
const tileNoPrice: SurfacePick = {
  id: 303,
  name: "Moonstone Hex Mosaic",
  category: "Tile & Mosaic",
  size: null,
  sellPrice: null, // quote-only
};

describe("buildSurfaceCartLines", () => {
  it("turns each priced surface pick into one cart line", () => {
    const lines = buildSurfaceCartLines([faucet, floor], "contractor");
    expect(lines).toHaveLength(2);
  });

  it("namespaces the code as PEL-<id> so it never collides with a cabinet masterCode", () => {
    const [line] = buildSurfaceCartLines([faucet], "contractor");
    expect(line.masterCode).toBe("PEL-101");
    expect(line.pelicanProductId).toBe(101);
    expect(line.name).toBe("Brushed Nickel Pull-Down Faucet");
  });

  it("carries distributorId null so it never triggers the cabinet distributor-lock", () => {
    const [line] = buildSurfaceCartLines([faucet], "homeowner");
    expect(line.distributorId).toBeNull();
  });

  it("uses a unique negative styleId per pick so two surfaces never collapse", () => {
    const lines = buildSurfaceCartLines([faucet, floor], "contractor");
    const ids = lines.map((l) => l.styleId);
    expect(ids).toEqual([-101, -202]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses the sell price as unit price and quantity 1", () => {
    const [line] = buildSurfaceCartLines([faucet], "wholesale");
    expect(line.unitPrice).toBe(189.0);
    expect(line.qty).toBe(1);
  });

  it("marks selected catalog surfaces as price-locked non-cabinet products", () => {
    const [line] = buildSurfaceCartLines([faucet], "homeowner");
    expect(line).toMatchObject({
      priceLocked: true,
      productKind: "surface",
      category: "Sinks & Faucets",
    });
  });

  it("shows the category (with size when present) as the line label", () => {
    const lines = buildSurfaceCartLines([faucet, floor], "contractor");
    expect(lines[0].styleLabel).toBe("Sinks & Faucets");
    expect(lines[1].styleLabel).toBe('Flooring · 7" x 48"');
  });

  it("skips unpriced (quote-only) picks", () => {
    const lines = buildSurfaceCartLines([faucet, tileNoPrice], "contractor");
    expect(lines).toHaveLength(1);
    expect(lines[0].masterCode).toBe("PEL-101");
  });

  it("prices only the final backsplash when a legacy selection still contains a replaced tile", () => {
    const prior = { ...tileNoPrice, id: 304, name: "Prior Tile", sellPrice: 8.5, threeDActive: false };
    const final = { ...tileNoPrice, id: 305, name: "Final Tile", sellPrice: 12.5, threeDActive: true };

    expect(buildSurfaceCartLines([prior, final], "homeowner")).toEqual([
      expect.objectContaining({ masterCode: "PEL-305", name: "Final Tile", unitPrice: 12.5 }),
    ]);
  });

  it("does not include an unpriced range top in the design or cart total", () => {
    const rangeTop: SurfacePick = {
      id: 707,
      name: "30 in. Range Top — pricing pending",
      category: "Range Tops",
      size: '30"',
      sellPrice: null,
    };
    expect(buildSurfaceCartLines([rangeTop], "homeowner")).toEqual([]);
  });

  it("passes the resolved tier through to each line", () => {
    const [line] = buildSurfaceCartLines([faucet], "homeowner");
    expect(line.tier).toBe("homeowner");
  });

  it("prices a fixture only for its active range-wall installation and suppresses stale selections", () => {
    const installed = buildSurfaceCartLines([faucet], "homeowner", undefined, new Map([[101, 2]]));
    expect(installed).toEqual([expect.objectContaining({ qty: 2, qtyNote: "2 installed fixtures" })]);
    expect(buildSurfaceCartLines([faucet], "homeowner", undefined, new Map([[101, 0]]))).toEqual([]);
  });
});

describe("buildSurfaceCartLines — box quantity with overage", () => {
  const backsplashTile: SurfacePick = {
    id: 401,
    name: "Glossy White Ceramic Subway",
    category: "Backsplash",
    size: "12x12 sheet",
    sellPrice: 14.99,
    coverageSqFt: 10, // 10 sq ft per box
  };
  const floorTile: SurfacePick = {
    id: 402,
    name: "Porcelain Floor Tile",
    category: "Flooring",
    size: "24x24",
    sellPrice: 3.99,
    coverageSqFt: 16, // 16 sq ft per box
  };
  const quartzSlab: SurfacePick = {
    id: 404,
    name: "Countertop slab test fixture",
    category: "Quartz Slabs (Countertops)",
    size: '126" x 63"',
    sellPrice: 1200,
  };
  const areas = { backsplashSqFt: 30, flooringSqFt: 120, countertopSqFt: 60 };

  it("calculates backsplash boxes with 15% overage, rounded up", () => {
    // 30 sq ft * 1.15 = 34.5 / 10 sq ft per box = 3.45 → ceil = 4 boxes
    const [line] = buildSurfaceCartLines([backsplashTile], "contractor", areas);
    expect(line.qty).toBe(4);
    expect(line.qtyNote).toContain("15%");
    expect(line.qtyNote).toContain("4 boxes");
  });

  it("calculates flooring boxes with 10% overage, rounded up", () => {
    // 120 sq ft * 1.10 = 132 / 16 sq ft per box = 8.25 → ceil = 9 boxes
    const [line] = buildSurfaceCartLines([floorTile], "contractor", areas);
    expect(line.qty).toBe(9);
    expect(line.qtyNote).toContain("10%");
    expect(line.qtyNote).toContain("9 boxes");
    expect(line.qtyNote).toContain("Layout not chosen");
  });

  it("uses the description carton size instead of a 20 sq ft default, and 20% waste for herringbone", () => {
    const described: SurfacePick = {
      id: 407,
      name: "Aviles 20mil Dryback",
      category: "Flooring",
      subCategory: "Planks & Flooring",
      sellPrice: 95.7,
      coverageSqFt: null,
      description: "Aviles 20mil Dryback - 17pc/box 41.99sqft/box",
    };
    const standard = buildSurfaceCartLines([described], "homeowner", { ...areas, flooringSqFt: 300 })[0];
    const herringbone = buildSurfaceCartLines([described], "homeowner", { ...areas, flooringSqFt: 300, flooringPattern: "herringbone" })[0];
    expect(standard.qty).toBe(Math.ceil((300 * 1.1) / 41.99));
    expect(standard.qtyNote).toContain("17 pieces/box");
    expect(standard.qtyNote).toContain("41.99 sq ft/box");
    expect(herringbone.qty).toBe(Math.ceil((300 * 1.2) / 41.99));
    expect(herringbone.qty).toBeGreaterThan(standard.qty);
    expect(herringbone.qtyNote).toContain("20%");
    expect(herringbone.qtyNote).toContain("Herringbone");
  });

  it("does not invent a flooring box count when neither coverageSqFt nor the description has one", () => {
    const bare: SurfacePick = {
      id: 408,
      name: "Unspecified plank",
      category: "Flooring",
      subCategory: "Planks & Flooring",
      sellPrice: 50,
      coverageSqFt: null,
      description: "Color sample only",
    };
    const [line] = buildSurfaceCartLines([bare], "homeowner", areas);
    expect(line.qty).toBe(1);
    expect(line.qtyNote).toContain("Sq ft per box was not on this product");
    expect(line.qtyNote).not.toContain("20 sq ft");
  });

  it("keeps an explicitly selected flooring trim as one priced product instead of applying room-area box math", () => {
    const trim: SurfacePick = {
      id: 406,
      name: "Aveline 20mil Stair Nose",
      category: "Flooring",
      subCategory: "Moldings & Trim",
      size: '94"',
      sellPrice: 19.5,
      coverageSqFt: 16,
    };

    const [line] = buildSurfaceCartLines([floorTile, trim], "contractor", areas).filter((item) => item.pelicanProductId === trim.id);
    expect(line).toMatchObject({ masterCode: "PEL-406", unitPrice: 19.5, qty: 1, priceLocked: true });
    expect(line.qtyNote).toBeUndefined();
  });

  it("prices countertop products as whole slabs using authoritative stored slab dimensions", () => {
    const [line] = buildSurfaceCartLines([quartzSlab], "homeowner", areas);
    expect(line.qty).toBe(2);
    expect(line.unitPrice).toBe(1200);
    expect(line.priceLocked).toBe(true);
    expect(line.productKind).toBe("surface");
    expect(line.qtyNote).toBe("60.0 sq ft ÷ 55.1 sq ft/slab = 2 slabs");
    expect(line.qty * (line.unitPrice ?? 0)).toBe(2400);
  });

  it("prices different wall-run and island countertop products from their own measured slab areas", () => {
    const wall = { ...quartzSlab, id: 405, name: "Wall Quartz", countertopScope: "perimeter" as const };
    const island = { ...quartzSlab, id: 406, name: "Island Granite", countertopScope: "island" as const };
    const lines = buildSurfaceCartLines([wall, island], "homeowner", {
      ...areas,
      countertopSqFt: 100,
      perimeterCountertopSqFt: 40,
      islandCountertopSqFt: 60,
    });
    expect(lines.find((line) => line.name === "Wall Quartz")).toMatchObject({ qty: 1 });
    expect(lines.find((line) => line.name === "Island Granite")).toMatchObject({ qty: 2 });
    expect(lines.find((line) => line.name === "Wall Quartz")?.qtyNote).toContain("40.0 sq ft wall-run");
    expect(lines.find((line) => line.name === "Island Granite")?.qtyNote).toContain("60.0 sq ft island");
  });

  it("does not invent a countertop quantity when stored slab dimensions are missing", () => {
    const [line] = buildSurfaceCartLines([{ ...quartzSlab, size: null }], "homeowner", areas);
    expect(line.qty).toBe(1);
    expect(line.qtyNote).toBeUndefined();
  });

  it("falls back to qty=1 when coverageSqFt is not set", () => {
    const noBox: SurfacePick = { ...backsplashTile, coverageSqFt: null };
    const [line] = buildSurfaceCartLines([noBox], "contractor", areas);
    expect(line.qty).toBe(1);
    expect(line.qtyNote).toBeUndefined();
  });

  it("falls back to qty=1 when areas are not provided", () => {
    const [line] = buildSurfaceCartLines([backsplashTile], "contractor");
    expect(line.qty).toBe(1);
  });

  it("falls back to qty=1 when area is 0 (no base cabinets placed yet)", () => {
    const zeroAreas = { backsplashSqFt: 0, flooringSqFt: 0 };
    const [line] = buildSurfaceCartLines([backsplashTile], "contractor", zeroAreas);
    expect(line.qty).toBe(1);
  });

  it("keeps the 15% overage on Tile & Mosaic rows that are not mosaics", () => {
    const wallTile: SurfacePick = {
      id: 403,
      name: "Glossy White 3x6 Wall Tile",
      category: "Tile & Mosaic",
      subCategory: "Tile",
      size: null,
      sellPrice: 9.99,
      coverageSqFt: 5,
    };
    // 30 sq ft * 1.15 = 34.5 / 5 = 6.9 → ceil = 7 boxes
    const [line] = buildSurfaceCartLines([wallTile], "contractor", areas);
    expect(line.qty).toBe(7);
    expect(line.qtyNote).toContain("15%");
    expect(line.qtyNote).not.toContain("5% waste");
  });

  it("prices a mosaic used as the floor from the floor area and keeps the wall use separate", () => {
    const mosaicFloor: SurfacePick = {
      id: 404,
      name: "Arctic Vail",
      category: "Tile & Mosaic",
      subCategory: "Mosaic",
      size: "11.81 x 11.81",
      sellPrice: 12,
      coverageSqFt: 10,
      installedAs: "flooring",
    };
    const mosaicWall: SurfacePick = { ...mosaicFloor, installedAs: "backsplash" };
    const lines = buildSurfaceCartLines([mosaicFloor, mosaicWall], "homeowner", areas);
    const floorLine = lines.find((line) => line.masterCode === "PEL-404-floor");
    const wallLine = lines.find((line) => line.masterCode === "PEL-404");
    expect(floorLine?.qtyNote).toContain("120.0 sq ft");
    expect(wallLine?.qtyNote).toContain("30.0 sq ft");
    expect(floorLine?.styleId).not.toBe(wallLine?.styleId);
    // The floor use keeps flooring waste (no layout chosen = the standard rate, not 5%).
    expect(floorLine?.qtyNote).toContain("10%");
    expect(floorLine?.qtyNote).not.toContain("5% waste");
    expect(wallLine?.qtyNote).toContain("5% waste");
  });
});

describe("buildSurfaceCartLines — mosaic backsplash 5% waste", () => {
  const areas = { backsplashSqFt: 30, flooringSqFt: 120, countertopSqFt: 60 };
  const mosaicBacksplash: SurfacePick = {
    id: 501,
    name: "Arctic Vail",
    category: "Tile & Mosaic",
    subCategory: "Mosaic",
    size: "10.71 x 10.55",
    sellPrice: 24,
    coverageSqFt: 5,
  };
  const fieldTileBacksplash: SurfacePick = {
    id: 502,
    name: "Glossy White Ceramic Subway",
    category: "Tile & Mosaic",
    subCategory: "Tile",
    size: "3x6",
    sellPrice: 8,
    coverageSqFt: 5,
  };

  it("adds exactly 5% waste to the measured mosaic backsplash square footage", () => {
    // 30 sq ft * 1.05 = 31.5 / 5 sq ft per box = 6.3 → ceil = 7 boxes
    const [line] = buildSurfaceCartLines([mosaicBacksplash], "homeowner", areas);
    expect(line.qty).toBe(Math.ceil((30 * 1.05) / 5));
    expect(line.qty).toBe(7);
    expect(line.qtyNote).toContain("30.0 sq ft × 5% overage");
    expect(line.qtyNote).toContain("includes 5% waste");
    expect(line.qtyNote).not.toContain("15%");
  });

  it("uses the owner's X * 1.05 formula rather than the 15% tile overage", () => {
    const [mosaicLine] = buildSurfaceCartLines([mosaicBacksplash], "homeowner", { ...areas, backsplashSqFt: 100 });
    const [tileLine] = buildSurfaceCartLines([fieldTileBacksplash], "homeowner", { ...areas, backsplashSqFt: 100 });
    // 100 * 1.05 = 105 / 5 = 21 boxes; 100 * 1.15 = 115 / 5 = 23 boxes.
    expect(mosaicLine.qty).toBe(21);
    expect(tileLine.qty).toBe(23);
    expect(mosaicLine.qty).toBeLessThan(tileLine.qty);
  });

  it("leaves field tile on the same backsplash at the 15% overage, with no mosaic note", () => {
    const [line] = buildSurfaceCartLines([fieldTileBacksplash], "homeowner", areas);
    expect(line.qty).toBe(Math.ceil((30 * 1.15) / 5));
    expect(line.qtyNote).toContain("15%");
    expect(line.qtyNote).not.toContain("5% waste");
  });

  it("does not apply the mosaic waste to countertops, sinks or faucets", () => {
    const quartz: SurfacePick = {
      id: 503,
      name: "Countertop slab",
      category: "Quartz Slabs (Countertops)",
      size: '126" x 63"',
      sellPrice: 1200,
    };
    const faucet: SurfacePick = {
      id: 504,
      name: "Arctic Vail Faucet",
      category: "Sinks & Faucets",
      subCategory: "Faucets",
      sellPrice: 189,
    };
    const lines = buildSurfaceCartLines([quartz, faucet], "homeowner", areas);
    expect(lines.every((line) => !line.qtyNote?.includes("5% waste"))).toBe(true);
  });

  it("rounds up to whole sellable units when the 5% pushes past a whole box", () => {
    // 20 sq ft * 1.05 = 21 / 10 sq ft per box = 2.1 → ceil = 3 boxes
    const [line] = buildSurfaceCartLines([{ ...mosaicBacksplash, coverageSqFt: 10 }], "homeowner", { ...areas, backsplashSqFt: 20 });
    expect(line.qty).toBe(3);
    // Without the mosaic waste the same area would only need two boxes.
    expect(Math.ceil(20 / 10)).toBe(2);
  });

  it("says the waste could not be applied when the mosaic has no box coverage and no published sheet size", () => {
    const [line] = buildSurfaceCartLines([{ ...mosaicBacksplash, coverageSqFt: null, size: null }], "homeowner", areas);
    expect(line.qty).toBe(1);
    expect(line.qtyNote).toContain("30.0 sq ft");
    expect(line.qtyNote).toContain("5% mosaic waste could not be added");
    expect(line.qtyNote).not.toContain("includes 5% waste");
  });

  it("rounds up to whole sheets from the published sheet size, which is what a real Pelican mosaic carries", () => {
    // Real catalog shape: size is the sheet size, and coverageSqFt is empty on every mosaic.
    // 11.81 x 11.81 sheet = 0.9686 sq ft per sheet.
    const catalogMosaic: SurfacePick = {
      id: 505,
      name: "Arctic Vail",
      category: "Tile & Mosaic",
      subCategory: "Mosaic",
      size: "10.71 x 10.55 x 8",
      sellPrice: 24,
      coverageSqFt: null,
    };
    const sheetSqFt = (10.71 * 10.55) / 144; // 0.7846 sq ft
    const [line] = buildSurfaceCartLines([catalogMosaic], "homeowner", { ...areas, backsplashSqFt: 30 });
    // 30 * 1.05 = 31.5 / 0.7846 = 40.15 → ceil = 41 sheets
    expect(line.qty).toBe(Math.ceil((30 * 1.05) / sheetSqFt));
    expect(line.qtyNote).toContain("sq ft/sheet");
    expect(line.qtyNote).toContain("41 sheets");
    expect(line.qtyNote).toContain("includes 5% waste");
    // The third number in the catalog size is the 8 mm thickness and must not become a dimension.
    expect(line.qtyNote).not.toContain("÷ 0.7846 sq ft/box");
  });

  it("keeps a structured coverage value authoritative over the sheet size when a vendor entered one", () => {
    const [line] = buildSurfaceCartLines([mosaicBacksplash], "homeowner", areas);
    expect(line.qtyNote).toContain("sq ft/box");
    expect(line.qtyNote).not.toContain("sq ft/sheet");
  });

  it("keeps the 5% note off a mosaic with no measured backsplash area yet", () => {
    const [line] = buildSurfaceCartLines([mosaicBacksplash], "homeowner", { ...areas, backsplashSqFt: 0 });
    expect(line.qty).toBe(1);
    expect(line.qtyNote).toBeUndefined();
  });

  it("keeps the 5% note off a quote-only mosaic that is skipped from the cart", () => {
    expect(buildSurfaceCartLines([{ ...mosaicBacksplash, sellPrice: null }], "homeowner", areas)).toEqual([]);
  });
});
