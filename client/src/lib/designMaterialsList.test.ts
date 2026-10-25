import { describe, expect, it } from "vitest";
import { buildMaterialsListRows, materialsListCsv, materialsListPricedTotal, materialsListPrintHtml, materialsListSectionFor } from "./designMaterialsList";

describe("complete Designer materials list", () => {
  const rows = buildMaterialsListRows({
    buildRows: [
      { sourceUids: ["w18-1"], code: "W-18", description: "18-inch Wall Cabinet", widthIn: 18, heightIn: 42, depthIn: 12, placement: "wall", color: "Aura Cream", qty: 1, unitPrice: 210 },
      { sourceUids: ["b24-1", "b24-2"], code: "B-24", description: "24-inch Base Cabinet", widthIn: 24, heightIn: 34.5, depthIn: 24, placement: "base", color: "Aura Cream", qty: 2, unitPrice: 300 },
      { code: "DW-24", description: "Dishwasher", widthIn: 24, heightIn: 34.5, depthIn: 24, placement: "appliance", qty: 1, unitPrice: null },
      { code: "BF-3", description: "Base filler cut to 2.5 inches", widthIn: 2.5, heightIn: 34.5, depthIn: 24, placement: "base", color: "Aura Cream", qty: 1, unitPrice: 35 },
      { code: "REP-2496", description: "Refrigerator end panel", widthIn: 0.75, heightIn: 96, depthIn: 24, placement: "tall", color: "Aura Cream", qty: 2, unitPrice: 50 },
    ],
    pricingLines: [
      { masterCode: "B-24", name: "24-inch Base Cabinet", styleId: 7, styleLabel: "Aura Cream", distributorId: 4, tier: "homeowner", unitPrice: 300, qty: 2 },
      { masterCode: "W-18", name: "18-inch Wall Cabinet", styleId: 7, styleLabel: "Aura Cream", distributorId: 4, tier: "homeowner", unitPrice: 210, qty: 1 },
      { masterCode: "PEL-90", name: "White Subway Backsplash", styleId: -90, styleLabel: "3 x 6", distributorId: null, tier: "homeowner", unitPrice: 48, qty: 3, category: "Backsplash", qtyNote: "30 sq ft including overage" },
      { masterCode: "FRIDGE-36", name: "French Door Refrigerator", styleId: -91, styleLabel: "Stainless steel", distributorId: null, tier: "homeowner", unitPrice: 500, qty: 1, category: "Appliances" },
    ],
    selectedSurfaces: [
      { id: 91, slug: "oak-floor", name: "Oak Flooring", category: "Flooring", subCategory: "Natural", size: "20 sq ft carton", imageUrl: null, sellPrice: null },
    ],
    supplements: [
      { code: "HW-PULL", description: "Bar pulls", category: "Hardware", qty: 8, styleColor: "Brushed brass", unitPrice: null },
      { code: "CM-96", description: "Crown molding", category: "Trim & molding", qty: 2, styleColor: "Aura Cream", unitPrice: null },
      { code: "TK-96", description: "Toe kick", category: "Trim & molding", qty: 2, styleColor: "Aura Cream", unitPrice: null },
    ],
    distributorNames: new Map([[4, "Ashford"]]),
    defaultDistributorId: 4,
    defaultStyleName: "Aura Cream",
  });

	  it("numbers cabinets, panels, fillers, and trim by code and alphabetizes every non-cabinet item below them", () => {
	    expect(rows.filter((row) => row.section === "cabinet").map((row) => [row.label, row.code, row.category])).toEqual([
	      ["1", "B-24", "Cabinet"],
	      ["2", "BF-3", "Filler"],
	      ["3", "CM-96", "Cabinet trim"],
	      ["4", "REP-2496", "Panel"],
	      ["5", "TK-96", "Cabinet trim"],
	      ["6", "W-18", "Cabinet"],
	    ]);
	    expect(rows.filter((row) => row.section === "other").map((row) => [row.label, row.description])).toEqual([
	      ["A", "Bar pulls"],
	      ["B", "Dishwasher"],
	      ["C", "French Door Refrigerator"],
	      ["D", "Oak Flooring"],
	      ["E", "White Subway Backsplash"],
	    ]);
	  });

	  it("keeps refrigerator appliances separate while classifying their panels and every cabinet trim family as cabinet parts", () => {
	    expect(materialsListSectionFor({ code: "FRIDGE-36", description: "French Door Refrigerator", category: "Appliances" })).toBe("other");
	    expect(materialsListSectionFor({ code: "REP-2496", description: "Refrigerator end panel", category: "Panel" })).toBe("cabinet");
	    expect(materialsListSectionFor({ code: "RS-24", description: "Roll-out shelf", category: "Accessory" })).toBe("cabinet");
	    expect(materialsListSectionFor({ code: "GD-W24", description: "Glass door upgrade", category: "Accessory" })).toBe("cabinet");
	    expect(materialsListSectionFor({ code: "HW-PULL", description: "Cabinet bar pull", category: "Handles & hardware" })).toBe("other");
	    for (const description of ["Base filler", "Crown molding", "Light rail molding", "Toe kick", "Scribe molding", "Arched valance", "Finished end panel"]) {
	      expect(materialsListSectionFor({ code: description.toUpperCase().replaceAll(" ", "-"), description, category: "Trim & molding" })).toBe("cabinet");
	    }
	  });

  it("preserves supplier, style, dimensions, quantities, and exact authoritative prices", () => {
    const base = rows.find((row) => row.code === "B-24")!;
    expect(base).toMatchObject({ supplier: "Ashford", styleColor: "Aura Cream", dimensions: '24\" W × 34.5\" H × 24\" D', qty: 2, unitPrice: 300, lineTotal: 600 });
    expect(base.sourceUids).toEqual(["b24-1", "b24-2"]);
    expect(rows.find((row) => row.code === "PEL-90")).toMatchObject({ supplier: "Backsplash", qty: 3, unitPrice: 48, lineTotal: 144, notes: "30 sq ft including overage" });
	    expect(rows.find((row) => row.code === "PEL-91")).toMatchObject({ unitPrice: null, lineTotal: null, priceStatus: "quote_required", notes: "Quote required" });
	    expect(materialsListPricedTotal(rows)).toBe(1589);
  });

  it("marks an unpriced placed cabinet unavailable rather than calling it price pending", () => {
    const unresolved = buildMaterialsListRows({
      buildRows: [{
        sourceUids: ["legacy-cabinet"],
        code: "UNVERIFIED-BASE",
        description: "Legacy base cabinet without an approved source alias",
        widthIn: 24,
        heightIn: 34.5,
        depthIn: 24,
        placement: "base",
        color: "Aura Cream",
        qty: 1,
        unitPrice: null,
      }],
      pricingLines: [],
      defaultStyleName: "Aura Cream",
    });

    expect(unresolved).toEqual([expect.objectContaining({
      section: "cabinet",
      unitPrice: null,
      lineTotal: null,
      priceStatus: "unavailable",
      notes: "Not purchasable — verified supplier price required",
    })]);
    const html = materialsListPrintHtml({ rows: unresolved });
    expect(html).toContain("Unavailable cabinet lines: 1");
    expect(html).not.toContain("Pending");
  });

  it("retains an authorized toe-kick trim price in Materials & Parts", () => {
    const pricedTrim = buildMaterialsListRows({
      buildRows: [],
      pricingLines: [],
      supplements: [{
        code: "TK-8(TKC)",
        description: "Toe kick",
        category: "Trim & molding",
        qty: 2,
        supplier: "Preston",
        styleColor: "Air Dawn (Preston)",
        unitPrice: 25.44,
      }],
      defaultStyleName: "Air Dawn (Preston)",
    });

    expect(pricedTrim).toEqual([expect.objectContaining({
      code: "TK-8(TKC)",
      section: "cabinet",
      supplier: "Preston",
      unitPrice: 25.44,
      lineTotal: 50.88,
      priceStatus: "priced",
    })]);
  });

  it("shows a selected exact Hardware Resources SKU once with its current unit and extended price", () => {
    const hardware = buildMaterialsListRows({
      buildRows: [],
      pricingLines: [{
        masterCode: "5319BG",
        name: "KEYGRANDE Bar pull — 14-1/8-inch Overall Length",
        styleId: -3900179,
        styleLabel: "Brushed Gold",
        distributorId: null,
        tier: "homeowner",
        unitPrice: 9.8,
        qty: 38,
        category: "Handles & hardware",
        productKind: "hardware",
        vendorProductId: 3900179,
        qtyNote: "38 bar pulls",
      }],
    });

    expect(hardware).toHaveLength(1);
    expect(hardware[0]).toMatchObject({
      section: "other",
      code: "5319BG",
      description: "KEYGRANDE Bar pull — 14-1/8-inch Overall Length",
      category: "Handles & hardware",
      supplier: "Hardware Resources",
      styleColor: "Brushed Gold",
      qty: 38,
      unitPrice: 9.8,
      priceStatus: "priced",
      notes: "38 bar pulls",
    });
    expect(hardware[0]?.lineTotal).toBeCloseTo(372.4, 8);
    expect(materialsListPricedTotal(hardware)).toBe(372.4);
    expect(materialsListCsv(hardware)).toContain("A,Other materials,5319BG");
    expect(materialsListPrintHtml({ rows: hardware })).toContain("$372.40");
  });

  it("includes an arched valance only when the plan deliberately supplies it", () => {
    const withoutValance = buildMaterialsListRows({
      buildRows: [{
        sourceUids: ["wall-30"],
        code: "W-3030",
        description: "30-inch Wall Cabinet",
        widthIn: 30,
        heightIn: 30,
        depthIn: 12,
        placement: "wall",
        color: "Serene Sage (Madison)",
        qty: 1,
        unitPrice: 250,
      }],
      pricingLines: [{ masterCode: "W-3030", name: "30-inch Wall Cabinet", styleId: 7, styleLabel: "Serene Sage (Madison)", distributorId: 4, tier: "homeowner", unitPrice: 250, qty: 1 }],
      supplements: [],
    });
    expect(withoutValance.some((row) => row.code === "VA-48")).toBe(false);

    const withDeliberateValance = buildMaterialsListRows({
      buildRows: [],
      pricingLines: [],
      supplements: [{
        code: "VA-48",
        description: "Arched valance",
        category: "Trim & molding",
        qty: 1,
        supplier: "Madison",
        styleColor: "Serene Sage (Madison)",
        unitPrice: 42,
      }],
    });
    expect(withDeliberateValance).toEqual([expect.objectContaining({
      code: "VA-48",
      description: "Arched valance",
      qty: 1,
      lineTotal: 42,
    })]);
  });

  it("lists only the final backsplash after a customer replaces an earlier tile", () => {
    const materials = buildMaterialsListRows({
      buildRows: [],
      pricingLines: [
        { masterCode: "PEL-183", name: "Prior Desert Clay", styleId: -183, styleLabel: "Tile & Mosaic", distributorId: null, tier: "homeowner", unitPrice: 9, qty: 3, category: "Tile & Mosaic" },
        { masterCode: "PEL-164", name: "Final Concord Square", styleId: -164, styleLabel: "Tile & Mosaic", distributorId: null, tier: "homeowner", unitPrice: 12, qty: 3, category: "Tile & Mosaic" },
      ],
      selectedSurfaces: [
        { id: 183, slug: "prior-desert-clay", name: "Prior Desert Clay", category: "Tile & Mosaic", sellPrice: 9, threeDActive: false },
        { id: 164, slug: "final-concord-square", name: "Final Concord Square", category: "Tile & Mosaic", sellPrice: 12, threeDActive: true },
      ],
    });

    expect(materials.map((row) => row.code)).toEqual(["PEL-164"]);
    expect(materials[0]).toMatchObject({ description: "Final Concord Square", unitPrice: 12, lineTotal: 36 });
  });

  it("does not resurrect a stale selected-surface price that is absent from the orderable cart", () => {
    const cartLines = [
      { masterCode: "B-24", name: "24-inch Base Cabinet", styleId: 7, styleLabel: "Aura Cream", distributorId: 4, tier: "homeowner" as const, unitPrice: 300, qty: 1 },
    ];
    const materials = buildMaterialsListRows({
      buildRows: [{
        sourceUids: ["base-24"],
        code: "B-24",
        description: "24-inch Base Cabinet",
        widthIn: 24,
        heightIn: 34.5,
        depthIn: 24,
        placement: "base",
        color: "Aura Cream",
        qty: 1,
        unitPrice: 300,
      }],
      pricingLines: cartLines,
      selectedSurfaces: [{
        id: 183,
        slug: "stale-desert-clay",
        name: "Desert Clay",
        category: "Backsplash",
        sellPrice: 89,
      }],
    });

    expect(materials.find((row) => row.code === "PEL-183")).toMatchObject({
      unitPrice: null,
      lineTotal: null,
      priceStatus: "quote_required",
    });
    expect(materialsListPricedTotal(materials)).toBe(300);
  });

  it("keeps an island-placed 30-inch wall cabinet in the cabinet invoice and materials output", () => {
    const islandWallRows = buildMaterialsListRows({
      buildRows: [
        {
          sourceUids: ["island-w3030"],
          code: "W-30-30",
          description: "30-inch Wall Cabinet on island",
          widthIn: 30,
          heightIn: 30,
          depthIn: 12,
          placement: "wall",
          color: "Aura Cream",
          qty: 1,
          unitPrice: 315,
        },
      ],
      pricingLines: [
        { masterCode: "W-30-30", name: "30-inch Wall Cabinet", styleId: 7, styleLabel: "Aura Cream", distributorId: 4, tier: "homeowner", unitPrice: 315, qty: 1 },
      ],
      selectedSurfaces: [],
      supplements: [],
      distributorNames: new Map([[4, "Ashford"]]),
      defaultDistributorId: 4,
      defaultStyleName: "Aura Cream",
    });

	    expect(islandWallRows).toContainEqual(expect.objectContaining({
	      code: "W-30-30",
	      section: "cabinet",
      dimensions: '30" W × 30" H × 12" D',
      qty: 1,
      unitPrice: 315,
      lineTotal: 315,
	      sourceUids: ["island-w3030"],
	    }));
	  });

	  it("uses the locked adjusted cabinet price without counting CUSTOM-ADJ a second time", () => {
	    const adjustedRows = buildMaterialsListRows({
	      buildRows: [
	        {
	          sourceUids: ["custom-b24"],
	          code: "B-24",
	          description: "24-inch Base Cabinet — custom width 25 inches",
	          widthIn: 25,
	          heightIn: 34.5,
	          depthIn: 24,
	          placement: "base",
	          color: "Aura Cream",
	          qty: 1,
	          unitPrice: 100,
	          pricingUnitPrice: 190,
	          discountPct: -10,
	        },
	        {
	          code: "CUSTOM-ADJ",
	          description: "Custom size adjustment ($100 per resized cabinet)",
	          widthIn: 0,
	          heightIn: 0,
	          depthIn: 0,
	          placement: "accessory",
	          qty: 1,
	          unitPrice: 100,
	        },
	      ],
	      pricingLines: [
	        {
	          masterCode: "B-24",
	          name: "24-inch Base Cabinet",
	          styleId: 7,
	          styleLabel: "Aura Cream",
	          distributorId: 4,
	          tier: "homeowner",
	          unitPrice: 190,
	          priceLocked: true,
	          qty: 1,
	        },
	      ],
	      distributorNames: new Map([[4, "Ashford"]]),
	      defaultDistributorId: 4,
	      defaultStyleName: "Aura Cream",
	    });

	    expect(adjustedRows).toContainEqual(expect.objectContaining({
	      code: "B-24",
	      unitPrice: 190,
	      lineTotal: 190,
	    }));
	    expect(adjustedRows.some((row) => row.code === "CUSTOM-ADJ")).toBe(false);
	    expect(materialsListPricedTotal(adjustedRows)).toBe(190);
	  });

	  it("matches standard and adjusted rows to their exact locked prices when the SKU and style are identical", () => {
	    const adjustedRows = buildMaterialsListRows({
	      buildRows: [
	        {
	          sourceUids: ["standard-b24"],
	          code: "B-24",
	          description: "24-inch Base Cabinet",
	          widthIn: 24,
	          heightIn: 34.5,
	          depthIn: 24,
	          placement: "base",
	          color: "Aura Cream",
	          qty: 1,
	          unitPrice: 100,
	          pricingUnitPrice: 100,
	        },
	        {
	          sourceUids: ["custom-b24"],
	          code: "B-24",
	          description: "24-inch Base Cabinet — custom width 25 inches",
	          widthIn: 25,
	          heightIn: 34.5,
	          depthIn: 24,
	          placement: "base",
	          color: "Aura Cream",
	          qty: 1,
	          unitPrice: 100,
	          pricingUnitPrice: 190,
	          discountPct: -10,
	        },
	        {
	          code: "CUSTOM-ADJ",
	          description: "Custom size adjustment ($100 per resized cabinet)",
	          widthIn: 0,
	          heightIn: 0,
	          depthIn: 0,
	          placement: "accessory",
	          qty: 1,
	          unitPrice: 100,
	        },
	      ],
	      pricingLines: [
	        { masterCode: "B-24", name: "24-inch Base Cabinet", styleId: 7, styleLabel: "Aura Cream", distributorId: 4, tier: "homeowner", unitPrice: 100, priceLocked: true, qty: 1 },
	        { masterCode: "B-24", name: "24-inch Base Cabinet", styleId: 7, styleLabel: "Aura Cream", distributorId: 4, tier: "homeowner", unitPrice: 190, priceLocked: true, qty: 1 },
	      ],
	      distributorNames: new Map([[4, "Ashford"]]),
	      defaultDistributorId: 4,
	      defaultStyleName: "Aura Cream",
	    });

	    expect(adjustedRows.filter((row) => row.code === "B-24").map((row) => [row.unitPrice, row.lineTotal])).toEqual([
	      [100, 100],
	      [190, 190],
	    ]);
	    expect(adjustedRows.some((row) => row.code === "CUSTOM-ADJ")).toBe(false);
	    expect(materialsListPricedTotal(adjustedRows)).toBe(290);
	  });

		it("exports spreadsheet-friendly columns without inventing pending prices", () => {
    const csv = materialsListCsv(rows);
    expect(csv).toContain("No.,Section,Item Code,Description,Category,Distributor,Color / Style,Dimensions,Qty,Unit Price,Line Total,Notes");
	    expect(csv).toContain('1,Cabinets & cabinet parts,B-24,24-inch Base Cabinet,Cabinet,Ashford,Aura Cream,"24"" W × 34.5"" H × 24"" D",2,300.00,600.00,');
	    expect(csv).toContain('2,Cabinets & cabinet parts,BF-3,Base filler cut to 2.5 inches,Filler');
	    expect(csv).toContain('4,Cabinets & cabinet parts,REP-2496,Refrigerator end panel,Panel');
	    expect(csv).toContain('C,Other materials,FRIDGE-36,French Door Refrigerator,Appliances');
	    expect(csv).toContain("D,Other materials,PEL-91,Oak Flooring,Flooring,Flooring,Natural,20 sq ft carton,1,,,Quote required");
  });

  it("builds a printable landscape table with both sections, exact totals, and escaped text", () => {
    const html = materialsListPrintHtml({ rows, title: "Tom's <Kitchen>", roomLabel: '144\" × 120\"', styleName: "Aura Cream", generatedAt: "August 29, 2026" });
    expect(html).toContain("Numbered Cabinets &amp; Cabinet Parts");
    expect(html).toContain("Other Materials &amp; Parts — Alphabetical");
	    expect(html).toContain("Priced total: $1589.00");
	    expect(html).toContain("Quote-required lines: 5");
    expect(html).toContain("Tom&#039;s &lt;Kitchen&gt;");
    expect(html).toContain("@page{size:letter landscape");
  });

  it("retains exact source identities so a conflict-only view can include a grouped affected cabinet without exposing unrelated materials", () => {
    const grouped = rows.find((row) => row.code === "B-24");
    const unrelated = rows.find((row) => row.code === "W-18");
    const conflicts = new Set(["b24-2"]);

    expect(grouped?.sourceUids?.some((uid) => conflicts.has(uid))).toBe(true);
    expect(unrelated?.sourceUids?.some((uid) => conflicts.has(uid))).toBe(false);
    expect(rows.filter((row) => (row.sourceUids ?? []).some((uid) => conflicts.has(uid))).map((row) => row.code)).toEqual(["B-24"]);
  });
});
