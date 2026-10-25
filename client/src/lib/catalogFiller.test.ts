import { describe, expect, it } from "vitest";
import { catalogFillerForGap, catalogFillerPricingId, catalogFillerSuggestion, fittedCatalogFillerDescription, isCatalogDecorativeLeg, isCatalogFiller, isCatalogPanel } from "./catalogFiller";
import { CUSTOM_SIZE_FEE, customSizeFee } from "./design";

const fillers = [
  { id: 4, masterCode: "BF-1.5", description: '1.5" x 34.5" Base Filler', category: "Filler", subCategory: "Filler", width: 1.5, depth: 24, height: 34.5, catalogImageUrl: null },
  { id: 1, masterCode: "BF-3", description: '3" x 34.5" Base Filler', category: "Filler", subCategory: "Filler", width: 3, depth: 24, height: 34.5, catalogImageUrl: null },
  { id: 2, masterCode: "BF-6", description: '6" x 34.5" Base Filler', category: "Filler", subCategory: "Filler", width: 6, depth: 24, height: 34.5, catalogImageUrl: null },
  { id: 3, masterCode: "WF342", description: '3" x 30" Wall Filler', category: "Filler", subCategory: "Filler", width: 3, depth: 12, height: 30, catalogImageUrl: null },
] as const;

describe("catalogFillerForGap", () => {
	it("uses one real 3-inch stock filler for every installed cut through 3 inches", () => {
	  expect(catalogFillerForGap(fillers, 2.25, "base")?.masterCode).toBe("BF-3");
	  expect(catalogFillerForGap(fillers, 4.5, "base")?.masterCode).toBe("BF-6");
	  expect(catalogFillerForGap(fillers, 0.125, "base")?.masterCode).toBe("BF-3");
	  expect(catalogFillerForGap(fillers, 0.625, "base")?.masterCode).toBe("BF-3");
	  expect(catalogFillerForGap(fillers, 1.5, "base")?.masterCode).toBe("BF-3");
	});

	it("never treats refrigerator or other end panels as fillers, even when an imported accessory category is wrong", () => {
	  const refrigeratorEndPanel = {
	    id: 2796,
	    masterCode: "REPV2796",
	    description: "Refrigerator End Panel 27 × 96",
	    category: "Filler",
	    subCategory: "Accessory",
	    width: 27,
	    depth: 0.75,
	    height: 96,
	    catalogImageUrl: null,
	  } as const;
	  const panelNamedAsFiller = { ...refrigeratorEndPanel, id: 2797, masterCode: "PANEL-3", description: '3" Panel Filler', width: 3 } as const;

	  expect(isCatalogPanel(refrigeratorEndPanel)).toBe(true);
	  expect(isCatalogFiller(refrigeratorEndPanel)).toBe(false);
	  expect(isCatalogFiller(panelNamedAsFiller)).toBe(false);
	  expect(catalogFillerForGap([refrigeratorEndPanel, panelNamedAsFiller, ...fillers], 1, "base")?.masterCode).toBe("BF-3");
		expect(catalogFillerPricingId({ id: 2796, masterCode: "REPV2796", description: refrigeratorEndPanel.description, category: "Filler", subCategory: "Accessory", width: 1, placement: "base" }, [refrigeratorEndPanel, ...fillers])).toBe(2796);
		});

		it("never substitutes dishwasher panels or toe-kick trim for CabinetDealz filler stock", () => {
			const forbidden = [
				{ id: 80, masterCode: "DW-PANEL", description: "Dishwasher end panel", category: "Filler", subCategory: "Filler", width: 3, depth: 24, height: 34.5, catalogImageUrl: null },
				{ id: 81, masterCode: "TK-4", description: "Toe kick board", category: "Filler", subCategory: "Filler", width: 4, depth: 0.25, height: 4.5, catalogImageUrl: null },
			] as const;
			for (const candidate of forbidden) expect(isCatalogFiller(candidate)).toBe(false);
			expect(catalogFillerForGap([...forbidden, ...fillers], 2, "base")?.masterCode).toBe("BF-3");
		});

			it("never treats a verified decorative-leg code as filler stock, even if a legacy import marks it Filler", () => {
		  const flutedDecorativeLeg = {
	    id: 9360233,
	    masterCode: "FLDL",
	    description: 'Fluted Decorative Leg - 3"W X 3"D X 34 1/2"H',
	    category: "Filler",
	    subCategory: null,
	    width: 3,
	    depth: 3,
	    height: 34.5,
	    catalogImageUrl: null,
	  } as const;

		  expect(isCatalogDecorativeLeg(flutedDecorativeLeg)).toBe(true);
		  expect(isCatalogFiller(flutedDecorativeLeg)).toBe(false);
		  for (const masterCode of ["CLDL", "SCDL", "SQDL"]) {
		    const sourceCodedLeg = { ...flutedDecorativeLeg, masterCode, description: "Legacy accessory import" };
		    expect(isCatalogDecorativeLeg(sourceCodedLeg)).toBe(true);
		    expect(isCatalogFiller(sourceCodedLeg)).toBe(false);
		  }
		  expect(catalogFillerForGap([flutedDecorativeLeg, ...fillers], 1, "base")?.masterCode).toBe("BF-3");
		});

	it("automatically calculates the exact installed cut and retained catalog filler identity", () => {
    expect(catalogFillerSuggestion(fillers, 2.5, "base")).toMatchObject({
      candidate: { id: 1, masterCode: "BF-3" },
      gapWidth: 2.5,
      catalogWidth: 3,
      installedWidth: 2.5,
      trimAmount: 0.5,
      description: '3" x 34.5" Base Filler — cut to 2.5"',
    });
    expect(catalogFillerSuggestion(fillers, 7, "base")).toBeNull();
  });

  it("prefers the matching wall-depth filler and preserves the catalog description with the exact cut size", () => {
    const wallFiller = catalogFillerForGap(fillers, 2.5, "wall");
    expect(wallFiller?.masterCode).toBe("WF342");
    expect(fittedCatalogFillerDescription(wallFiller!, 2.5)).toBe('3" x 30" Wall Filler — cut to 2.5"');
  });

  it("calls fitted scribe stock a filler while preserving its source SKU for ordering", () => {
    const scribeStock = { id: 41, masterCode: "SCR", description: 'Scribe Molding - 96"', category: "Filler", subCategory: "Filler", width: 3, depth: 0.75, height: 96, catalogImageUrl: null } as const;
    expect(isCatalogFiller(scribeStock)).toBe(true);
    expect(fittedCatalogFillerDescription(scribeStock, 2.75)).toBe('Filler — cut to 2.75"');
  });

  it("keeps a trimmed catalog filler at its approved SKU price rather than applying a generic cabinet resize fee", () => {
    expect(customSizeFee({ width: 2.5, nominalWidth: 3, depth: 24, nominalDepth: 24, masterCode: "BF-3", subCategory: "Filler" })).toBe(0);
    expect(customSizeFee({ width: 25, nominalWidth: 24, depth: 24, nominalDepth: 24, masterCode: "B24", subCategory: "Base" })).toBe(CUSTOM_SIZE_FEE);
  });

  it("resolves a legacy generic filler to the same active catalog item used for a new fitted gap", () => {
    expect(catalogFillerPricingId({ id: 0, masterCode: "FILL-2.25", description: '2.25" Filler', category: "Accessory", subCategory: "Filler", width: 2.25, placement: "base" }, fillers)).toBe(1);
    expect(catalogFillerPricingId({ id: 24, masterCode: "B24", description: "Base", category: "Base", subCategory: "Base", width: 24, placement: "base" }, fillers)).toBe(24);
  });

	it("rebases a stale positive filler id to the active cuttable catalog filler before pricing", () => {
	  expect(catalogFillerPricingId({ id: 9999, cabinetId: 9999, masterCode: "BF-3", description: '3" x 34.5" Base Filler — cut to 2.25"', category: "Filler", subCategory: "Filler", width: 2.25, placement: "base" }, fillers)).toBe(1);
	  expect(catalogFillerPricingId({ id: 2, cabinetId: 2, masterCode: "BF-6", description: '6" x 34.5" Base Filler — cut to 4.5"', category: "Filler", subCategory: "Filler", width: 4.5, placement: "base" }, fillers)).toBe(2);
	});

	it("rebases a prior smaller-stock 5/8-inch filler to the 3-inch cart SKU", () => {
	  expect(catalogFillerPricingId({ id: 4, cabinetId: 4, masterCode: "BF-1.5", description: '1.5" Base Filler — cut to 0.625"', category: "Filler", subCategory: "Filler", width: 0.625, placement: "base" }, fillers)).toBe(1);
	});

	it("accepts only the source-documented 2-7/8-inch AltaEuro nominal 3-inch overlay stock for a sub-three-inch seam", () => {
	  const aefOverlay = { id: 901, masterCode: "OF335", description: '3" Filler Overlay — 2-7/8" W × 35-1/8" H × 3/4" D', category: "Accessory", subCategory: "Filler", width: 2.875, depth: 0.75, height: 35.125, catalogImageUrl: null } as const;
	  const unrelatedTrim = { ...aefOverlay, id: 902, masterCode: "TRIM2875", description: '2-7/8" trim strip' } as const;
	  expect(catalogFillerForGap([aefOverlay], 0.5, "base")?.masterCode).toBe("OF335");
	  expect(catalogFillerSuggestion([aefOverlay], 0.5, "base")).toMatchObject({ candidate: { masterCode: "OF335" }, installedWidth: 0.5, trimAmount: 2.375 });
	  expect(catalogFillerForGap([unrelatedTrim], 0.5, "base")).toBeNull();
	});

	it("lets the nominal 3-inch AltaEuro overlay satisfy an exact 3-inch blind-corner seam, but not arbitrary 2-7/8-inch trim or a wider seam", () => {
	  const aefOverlay = { id: 903, masterCode: "OF323", description: '3" Filler Overlay — 2-7/8" W × 22-1/2" H × 3/4" D', category: "Accessory", subCategory: "Filler", width: 2.875, depth: 0.75, height: 22.5, catalogImageUrl: null } as const;
	  const unrelatedTrim = { ...aefOverlay, id: 904, masterCode: "TRIM2875", description: '2-7/8" trim strip' } as const;
	  expect(catalogFillerForGap([aefOverlay], 3, "base")?.masterCode).toBe("OF323");
	  expect(catalogFillerForGap([unrelatedTrim], 3, "base")).toBeNull();
	  // A real 4-inch seam still needs genuinely wider stock, never the nominal 3-inch board.
	  expect(catalogFillerForGap([aefOverlay], 4, "base")).toBeNull();
	});
});
