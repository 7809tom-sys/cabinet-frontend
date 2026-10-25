import { describe, expect, it } from "vitest";
import { buildDesignCabinetCartLines, buildDesignPreviewPricingLines, bundleCabinetPricingSignature, calculateCartSubtotal, completeDesignPricingLines, lockDesignCartLinesToPackageTotal, mergeDesignCartLines } from "./designCartLines";
import { appendRefrigeratorEnclosurePlacements, CUSTOM_SIZE_FEE, type PlacedCabinet } from "@/lib/design";
import { buildRequiredBlindCornerFiller } from "@/lib/blindCornerRequiredFiller";
import { activeCatalogPricingIdsByMasterCode, currentCatalogPricingCabinetId } from "@/lib/designPricingIdentity";

const bec = {
  uid: "bec-one",
  cabinetId: 9450022,
  masterCode: "BEC-24",
  description: '24" Base End Angle Cabinet',
  category: "Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 24,
  depth: 24,
  rotation: 0,
} as PlacedCabinet;

describe("designer cabinet cart lines", () => {
	  it("combines a one-inch-or-smaller visual filler cut into an existing filler line", () => {
	    const primary = {
	      ...bec,
	      uid: "primary-filler",
	      cabinetId: 342,
	      masterCode: "F342",
	      description: '3" Stock Wall Filler',
	      category: "Filler",
	      subCategory: "Filler",
	      placement: "wall",
	      width: 3,
	      nominalWidth: 3,
	      fillerTotalWidth: 3,
	      fillerBillingRole: "primary" as const,
	    } as PlacedCabinet;
	    const cut = { ...primary, uid: "sub-inch-cut", width: 0.5, fillerTotalWidth: 0.5 } as PlacedCabinet;
	    const lines = buildDesignCabinetCartLines({
	      placed: [primary, cut],
	      styleId: 330002,
	      distributorId: 210001,
	      tier: "homeowner",
	      styleNameById: new Map([[330002, "Aura Cream"]]),
	      unitPriceFor: () => 35,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ masterCode: "F342", qty: 1 });
    expect(lines[0]?.qtyNote).toContain('Includes 0.5" field-cut from F342 already on order');
    const preview = buildDesignPreviewPricingLines({
      placed: [primary, cut],
      styleId: 330002,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330002, "Aura Cream"]]),
      unitPriceFor: () => 35,
    });
    expect(preview).toHaveLength(1);
    expect(preview[0]?.qtyNote).toContain('Includes 0.5" field-cut from F342 already on order');
  });

	  it("emits a first-class cooktop with its catalog code, name, and price", () => {
	    const cooktop = { ...bec, uid: "cooktop-gas", cabinetId: 0, masterCode: "CATALOG-APPLIANCE-77", description: "Gas Cooktop", placement: "appliance", applianceRole: "countertop-opening" as const, applianceProductId: 77, applianceCatalogCode: "CTGAS30", applianceCatalogName: "30 in. Gas Cooktop", applianceCatalogPrice: 899 } as PlacedCabinet;
	    expect(buildDesignCabinetCartLines({ placed: [cooktop], styleId: 330002, distributorId: 210001, tier: "homeowner", styleNameById: new Map([[330002, "Aura Cream"]]), unitPriceFor: () => null })).toEqual([
	      expect.objectContaining({ masterCode: "CTGAS30", name: "30 in. Gas Cooktop", unitPrice: 899, qty: 1 }),
	    ]);
	  });

	  it("keeps an unpriced first-class cooktop visible to the preview as quote-required", () => {
	    const cooktop = { ...bec, uid: "cooktop-pending", cabinetId: 0, placement: "appliance", applianceRole: "countertop-opening" as const, applianceCatalogCode: "CTIND30", applianceCatalogName: "30 in. Induction Cooktop", applianceCatalogPrice: null } as PlacedCabinet;
	    expect(buildDesignPreviewPricingLines({ placed: [cooktop], styleId: 330002, distributorId: 210001, tier: "homeowner", styleNameById: new Map([[330002, "Aura Cream"]]), unitPriceFor: () => null })[0]).toMatchObject({ masterCode: "CTIND30", name: "30 in. Induction Cooktop", unitPrice: null });
	  });
		  it("uses W-24-42's verified $265.06 tier price for legacy WFR2442 in both preview and locked cart", () => {
	    const legacyWfr = {
	      ...bec,
	      uid: "legacy-wfr2442",
	      cabinetId: 9390140,
	      masterCode: "WFR2442",
	      description: '24" Double Door Wall Cabinet with 3 Adjustable Shelves',
	      placement: "wall",
	      width: 24,
	      depth: 12,
	      height: 42,
	    } as PlacedCabinet;
	    const identities = activeCatalogPricingIdsByMasterCode([
	      { id: 9390128, masterCode: "W-24-42" },
	    ]);
	    const verifiedTierPrices = new Map([["9390128:330002", 265.06]]);
	    const unitPriceFor = (cabinet: PlacedCabinet) => verifiedTierPrices.get(
	      `${currentCatalogPricingCabinetId(cabinet, identities)}:330002`,
	    ) ?? null;
	    const common = {
	      placed: [legacyWfr],
	      styleId: 330002,
	      distributorId: 210001,
	      tier: "homeowner" as const,
	      styleNameById: new Map([[330002, "Aero Blanc (Preston)"]]),
	      unitPriceFor,
	    };
	    expect(buildDesignPreviewPricingLines(common)).toEqual([
	      expect.objectContaining({ masterCode: "WFR2442", unitPrice: 265.06, qty: 1, placementUids: ["legacy-wfr2442"] }),
	    ]);
	    expect(buildDesignCabinetCartLines(common)).toEqual([
	      expect.objectContaining({ masterCode: "WFR2442", unitPrice: 265.06, qty: 1, priceLocked: true }),
	    ]);
		  });

	  it("keeps a legacy SCR SKU priced while showing its installed role as Filler", () => {
	    const installedScribe = {
	      ...bec,
	      uid: "scribe-filler",
	      cabinetId: 42,
	      masterCode: "SCR",
	      description: 'Scribe Molding - 96" — A front filler cut to 2¾" with 22.5° miter (forms 45° turn)',
	      category: "Filler",
	      subCategory: "Filler",
	      width: 2.75,
	      nominalWidth: 3,
	      fillerPieceGroupId: "turn-1",
	      fillerPlacementMode: "left",
	    } as PlacedCabinet;
	    const common = {
	      placed: [installedScribe], styleId: 330002, distributorId: 210001, tier: "homeowner" as const,
	      styleNameById: new Map([[330002, "Aero Blanc (Preston)"]]), unitPriceFor: () => 18.25,
	    };
	    expect(buildDesignCabinetCartLines(common)[0]).toMatchObject({ masterCode: "SCR", name: 'Filler — A front filler cut to 2¾" with 22.5° miter (forms 45° turn)' });
	    expect(buildDesignPreviewPricingLines(common)[0]).toMatchObject({ masterCode: "SCR", name: 'Filler — A front filler cut to 2¾" with 22.5° miter (forms 45° turn)' });
  });

  it("keeps cart and preview identity on the active supplier style for a stale foreign saved finish", () => {
    const foreignFinishCabinet = { ...bec, uid: "foreign-finish", styleId: 330003 } as PlacedCabinet;
    const common = {
      placed: [foreignFinishCabinet],
      styleId: 390019,
      pricingStyleIdFor: () => 390019,
      distributorId: 180001,
      tier: "homeowner" as const,
      styleNameById: new Map([[390019, "Slim Amber Oak"]]),
      unitPriceFor: () => 412.5,
    };

    expect(buildDesignCabinetCartLines(common)).toEqual([
      expect.objectContaining({ styleId: 390019, styleLabel: "Slim Amber Oak", unitPrice: 412.5, priceLocked: true }),
    ]);
    expect(buildDesignPreviewPricingLines(common)).toEqual([
      expect.objectContaining({ styleId: 390019, styleLabel: "Slim Amber Oak", unitPrice: 412.5, placementUids: ["foreign-finish"] }),
    ]);
  });

	  it("prices a mandatory BBC filler through its real catalog cabinet ID and SKU", () => {
	    const blind = {
	      ...bec,
	      uid: "bbc-cart",
	      cabinetId: 36,
	      masterCode: "BBC-36",
	      description: '36" Blind Corner Base Cabinet',
	      x: 0,
	      y: 3,
	      width: 36,
	      depth: 24,
	      height: 34.5,
	      pullMin: 3,
	      pullMax: 6,
	      blindPull: 3,
	      styleId: 330011,
	    } as PlacedCabinet;
	    const required = buildRequiredBlindCornerFiller(blind, { width: 144, depth: 120 }, [{
	      id: 501,
	      masterCode: "BF-3",
	      description: '3" Base Filler',
	      category: "Accessories & Trim",
	      subCategory: "Filler",
	      width: 3,
	      height: 34.5,
	      depth: null,
	      catalogImageUrl: null,
	    }], () => "bbc-cart-filler", 330011);
	    expect(required.ok).toBe(true);
	    if (!required.ok) return;
	    const pricedCabinetIds: number[] = [];
	    const lines = buildDesignCabinetCartLines({
	      placed: [blind, required.filler],
	      styleId: 330011,
	      distributorId: 210001,
	      tier: "homeowner",
	      styleNameById: new Map([[330011, "Aura Cream"]]),
	      unitPriceFor: (cabinet) => {
	        pricedCabinetIds.push(cabinet.cabinetId);
	        return cabinet.cabinetId === 501 ? 45 : 300;
	      },
	    });
	    expect(pricedCabinetIds).toContain(501);
	    expect(lines.find((line) => line.masterCode === "BF-3")).toMatchObject({
	      styleId: 330011,
	      distributorId: 210001,
	      unitPrice: 45,
	      qty: 1,
	      priceLocked: true,
	    });
	    expect(calculateCartSubtotal(lines)).toBe(345);
	  });

  it("preserves the verified BA-24 source unit price and total for BEC-24", () => {
    const verifiedAshfordPrice = 365.95;
    const lines = buildDesignCabinetCartLines({
      placed: [bec, { ...bec, uid: "bec-two", x: 24 }],
      styleId: 330001,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => verifiedAshfordPrice,
    });

    expect(lines).toEqual([
      expect.objectContaining({
        masterCode: "BEC-24",
        distributorId: 210001,
        styleId: 330001,
        unitPrice: verifiedAshfordPrice,
        qty: 2,
      }),
    ]);
    expect(calculateCartSubtotal(lines)).toBe(731.9);
  });

	  it("combines a sub-inch filler cut into the wider filler already on order", () => {
    const shortFiller = {
      ...bec,
      uid: "f342-five-eighths",
      cabinetId: 342,
      masterCode: "F342",
      description: '3" Stock Wall Filler',
      placement: "wall",
      width: 0.625,
      nominalWidth: 3,
      fillerTotalWidth: 0.625,
      fillerBillingRole: "primary",
    } as PlacedCabinet;
    const widerCut = { ...shortFiller, uid: "f342-two-inch", width: 2, fillerTotalWidth: 2 } as PlacedCabinet;
    const lines = buildDesignCabinetCartLines({
      placed: [shortFiller, widerCut],
      styleId: 330001,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => 18.66,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ masterCode: "F342", qty: 1, fillerInstalledCutWidthIn: 2 });
    expect(lines[0]?.qtyNote).toContain('Includes 0.625" field-cut from F342 already on order');
  });

  it.each(["wholesale", "contractor", "homeowner"] as const)("marks every %s design line as price-locked at the designer-to-cart handoff", (tier) => {
    const lines = buildDesignCabinetCartLines({
      placed: [bec],
      styleId: 330001,
      distributorId: 210001,
      tier,
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => 365.95,
    });

    expect(lines).toEqual([
      expect.objectContaining({
        tier,
        unitPrice: 365.95,
        priceLocked: true,
      }),
    ]);
  });

  it("keeps visual-only appliance placements out of launch design commerce", () => {
    const visualRange = {
      uid: "range-one",
      cabinetId: 1,
      masterCode: "RANGE-30",
      description: '30" Visual Range',
      category: "Appliances",
      placement: "appliance",
      x: 24,
      y: 0,
      width: 30,
      depth: 25,
      rotation: 0,
      catalogImageUrl: "/manus-storage/original-range.webp",
    } as PlacedCabinet;
    const lines = buildDesignCabinetCartLines({
      placed: [bec, visualRange],
      styleId: 330001,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => 365.95,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ masterCode: "BEC-24", qty: 1 });
    expect(calculateCartSubtotal(lines)).toBe(365.95);
  });

  it("keeps independently selected refrigerator parts source-priced without shifting a refrigerator or B-18", () => {
    const b18 = { ...bec, uid: "b18-fridge-neighbor", cabinetId: 1801, masterCode: "B-18", description: '18" Base Cabinet', width: 18 } as PlacedCabinet;
    const fridge = { ...bec, uid: "fridge-36", cabinetId: 3601, masterCode: "FRIDGE-36", description: '36" Refrigerator', placement: "appliance", x: 18, width: 36, depth: 30, height: 70 } as PlacedCabinet;
    const leftPanel = { ...bec, uid: "left-repv", cabinetId: 9601, masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", customProfile: "refrigerator-end-panel", x: 17.25, width: 0.75, depth: 30, height: 96, refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "left-panel" } as PlacedCabinet;
    const rightPanel = { ...leftPanel, uid: "right-repv", cabinetId: 9602, x: 54, refrigeratorAssemblyRole: "right-panel" } as PlacedCabinet;
    const enclosure = appendRefrigeratorEnclosurePlacements([b18, fridge], [leftPanel, rightPanel], fridge.uid);
    const lines = buildDesignCabinetCartLines({
      placed: [b18, leftPanel, rightPanel],
      styleId: 330001, distributorId: 210001, tier: "homeowner",
      styleNameById: new Map([[330001, "Ashford Style"]]), unitPriceFor: () => 100,
    });

    expect(enclosure.placed.find((item) => item.uid === b18.uid)?.x).toBe(0);
    expect(enclosure.placed.find((item) => item.uid === fridge.uid)?.x).toBe(18);
    expect(enclosure.rejected.map((item) => item.uid)).toContain(leftPanel.uid);
    expect(lines.map((line) => line.masterCode)).toEqual(["B-18", "REPV-96"]);
    expect(lines.find((line) => line.masterCode === "REPV-96")).toMatchObject({ qty: 2, unitPrice: 100, priceLocked: true });
  });

  it("does not shift a wall-start refrigerator when optional panels are considered", () => {
    const fridge = { ...bec, uid: "wall-start-fridge", cabinetId: 3601, masterCode: "FRIDGE-36", description: '36" Refrigerator', placement: "appliance", x: 0, width: 36, depth: 30, height: 70 } as PlacedCabinet;
    const b21 = { ...bec, uid: "wall-start-b21", cabinetId: 2101, masterCode: "B-21", description: '21" Base Cabinet', placement: "base", x: 43, width: 21, depth: 24, height: 34.5 } as PlacedCabinet;
    const leftPanel = { ...bec, uid: "wall-start-left", cabinetId: 9601, masterCode: "REPV-96", description: "Refrigerator End Panel", placement: "tall", customProfile: "refrigerator-end-panel", x: -0.75, width: 0.75, depth: 30, height: 96, refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "left-panel" } as PlacedCabinet;
    const rightPanel = { ...leftPanel, uid: "wall-start-right", cabinetId: 9602, x: 36, refrigeratorAssemblyRole: "right-panel" } as PlacedCabinet;
    const enclosure = appendRefrigeratorEnclosurePlacements([fridge, b21], [leftPanel, rightPanel], fridge.uid);

    expect(enclosure.placed.find((item) => item.uid === fridge.uid)?.x).toBe(0);
    expect(enclosure.placed.find((item) => item.uid === b21.uid)?.x).toBe(43);
    expect(enclosure.placed.find((item) => item.uid === leftPanel.uid)?.x).toBe(-0.75);
    expect(enclosure.placed.find((item) => item.uid === rightPanel.uid)?.x).toBe(36);
  });

  it("locks loaded bundle lines to the verified package total without changing catalog source prices", () => {
    const secondCabinet = { ...bec, uid: "bec-other", masterCode: "B-30", description: '30" Base Cabinet', x: 24 } as PlacedCabinet;
    const lines = buildDesignCabinetCartLines({
      placed: [bec, secondCabinet],
      styleId: 330001,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: (cabinet) => cabinet.masterCode === "BEC-24" ? 7000 : 6000,
    });
    const locked = lockDesignCartLinesToPackageTotal(lines, 4116.84);
    expect(calculateCartSubtotal(locked)).toBe(4116.84);
    expect(locked.every((line) => line.priceLocked)).toBe(true);
    expect(bundleCabinetPricingSignature([bec, secondCabinet], 330001)).toBe(bundleCabinetPricingSignature([secondCabinet, bec], 330001));
  });

  it("keeps the 3D cabinet-design subtotal aligned with discounts and custom-size fees while excluding visual appliances", () => {
    const discountedBec = { ...bec, discountPct: -10 } as PlacedCabinet;
    const customBec = { ...bec, uid: "custom-bec", width: 25, nominalWidth: 24 } as PlacedCabinet;
    const visualRange = { ...bec, uid: "range-one", masterCode: "RANGE-30", placement: "appliance" } as PlacedCabinet;
    const lines = buildDesignPreviewPricingLines({
      placed: [discountedBec, customBec, visualRange],
      styleId: 330001,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => 100,
    });
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.masterCode)).not.toContain("RANGE-30");
    expect(calculateCartSubtotal(lines)).toBe(90 + 100 + CUSTOM_SIZE_FEE);
  });

  it("locks the same discount and custom-size adjustments into the cart handoff used by checkout", () => {
    const discountedBec = { ...bec, discountPct: -10 } as PlacedCabinet;
    const customBec = { ...bec, uid: "custom-bec", width: 25, nominalWidth: 24 } as PlacedCabinet;
    const cartLines = buildDesignCabinetCartLines({
      placed: [discountedBec, customBec],
      styleId: 330001,
      distributorId: 210001,
      tier: "contractor",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => 100,
    });
    const previewLines = buildDesignPreviewPricingLines({
      placed: [discountedBec, customBec],
      styleId: 330001,
      distributorId: 210001,
      tier: "contractor",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => 100,
    });

    expect(cartLines).toHaveLength(2);
    expect(cartLines.every((line) => line.priceLocked)).toBe(true);
    expect(calculateCartSubtotal(cartLines)).toBe(90 + 100 + CUSTOM_SIZE_FEE);
    expect(calculateCartSubtotal(cartLines)).toBe(calculateCartSubtotal(previewLines));
  });

  it("uses one complete price basis for 3D, cart, and checkout while retaining pending cabinet identities", () => {
    const cartLines = [
      {
        masterCode: "B-24",
        name: "24-inch Base",
        styleId: 330021,
        styleLabel: "Honey Core (Madison)",
        distributorId: 210002,
        tier: "contractor" as const,
        unitPrice: 300,
        priceLocked: true,
        qty: 1,
      },
      {
        masterCode: "PEL-769",
        name: "Faucet",
        styleId: -769,
        styleLabel: "Sinks & Faucets",
        distributorId: null,
        tier: "contractor" as const,
        unitPrice: 84.39,
        priceLocked: true,
        qty: 1,
      },
    ];
    const cabinetPreviewLines = [
      { ...cartLines[0], placementUids: ["placed-b24"] },
      {
        ...cartLines[0],
        masterCode: "WDC2442",
        name: "Wall Diagonal Corner",
        unitPrice: null,
        placementUids: ["pending-wdc"],
      },
    ];

    const complete = completeDesignPricingLines(cartLines, cabinetPreviewLines);
    expect(calculateCartSubtotal(complete)).toBe(384.39);
    expect(complete.find((line) => line.masterCode === "B-24")?.placementUids).toEqual(["placed-b24"]);
    expect(complete.find((line) => line.masterCode === "PEL-769")).toMatchObject({ unitPrice: 84.39, priceLocked: true });
    expect(complete.find((line) => line.masterCode === "WDC2442")).toMatchObject({ unitPrice: null, placementUids: ["pending-wdc"] });
  });

  it("merges only exact locked price identities and keeps adjusted cabinets separate", () => {
    const common = {
      masterCode: "B-24",
      name: "24-inch Base",
      styleId: 330021,
      styleLabel: "Honey Core (Madison)",
      distributorId: 210002,
      tier: "contractor" as const,
      priceLocked: true,
      qty: 1,
    };
    const merged = mergeDesignCartLines([
      { ...common, unitPrice: 300 },
      { ...common, unitPrice: 300 },
      { ...common, unitPrice: 270 },
      { ...common, unitPrice: 400 },
    ]);

    expect(merged).toHaveLength(3);
    expect(merged.find((line) => line.unitPrice === 300)?.qty).toBe(2);
    expect(calculateCartSubtotal(merged)).toBe(1270);
  });

  it("does not merge two exact Hardware Resources variants just because their display fields overlap", () => {
    const common = {
      masterCode: "5319",
      name: "KEYGRANDE Bar pull",
      styleId: -1,
      styleLabel: "Brushed Gold",
      distributorId: null,
      tier: "homeowner" as const,
      unitPrice: 9.8,
      priceLocked: true,
      qty: 1,
      category: "Handles & hardware",
      productKind: "hardware" as const,
    };
    const merged = mergeDesignCartLines([
      { ...common, vendorProductId: 3900179 },
      { ...common, vendorProductId: 3900180 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((line) => line.vendorProductId)).toEqual([3900179, 3900180]);
  });

  it("keeps an unpriced placed cabinet in the 3D order lines as a pending-price item", () => {
    const pendingSinkBase = {
      ...bec,
      uid: "sink-base-pending",
      masterCode: "SB-33",
      description: '33" Sink Base Cabinet',
    } as PlacedCabinet;
    const lines = buildDesignPreviewPricingLines({
      placed: [bec, pendingSinkBase],
      styleId: 330001,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: (cabinet) => cabinet.masterCode === "SB-33" ? null : 365.95,
    });

    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ masterCode: "SB-33", unitPrice: null, qty: 1 }),
    ]));
    expect(calculateCartSubtotal(lines)).toBe(365.95);
  });

  it("keeps a placed wall cabinet in Cart exactly once while a source price is pending", () => {
    const pendingWall = {
      ...bec,
      uid: "pending-wall-cart",
      cabinetId: 9390300,
      masterCode: "W2430",
      description: '24" Double Door Wall Cabinet',
      category: "Wall",
      placement: "wall",
      width: 24,
      height: 30,
      depth: 12,
    } as PlacedCabinet;
    const common = {
      placed: [pendingWall],
      styleId: 330001,
      distributorId: 210001,
      tier: "homeowner" as const,
      styleNameById: new Map([[330001, "Ashford Style"]]),
      unitPriceFor: () => null,
    };

    const cartLines = buildDesignCabinetCartLines(common);
    const previewLines = buildDesignPreviewPricingLines(common);
    const completeLines = completeDesignPricingLines(cartLines, previewLines);

    expect(cartLines).toEqual([
      expect.objectContaining({ masterCode: "W2430", unitPrice: null, qty: 1 }),
    ]);
    expect(cartLines[0]?.priceLocked).toBeUndefined();
    expect(completeLines).toHaveLength(1);
    expect(completeLines[0]).toMatchObject({ masterCode: "W2430", unitPrice: null, placementUids: ["pending-wall-cart"] });

    const zeroPriceLines = buildDesignCabinetCartLines({ ...common, unitPriceFor: () => 0 });
    expect(zeroPriceLines).toEqual([
      expect.objectContaining({ masterCode: "W2430", unitPrice: null, qty: 1 }),
    ]);
    expect(zeroPriceLines[0]?.priceLocked).toBeUndefined();
  });

  it("keeps the exact placed-cabinet UIDs on 3D preview price lines so a selected SB-33 reads its own price", () => {
    const pricedSinkBase = {
      ...bec,
      uid: "selected-sb-33",
      masterCode: "SB-33",
      description: '33" Sink Base Cabinet',
    } as PlacedCabinet;
    const lines = buildDesignPreviewPricingLines({
      placed: [pricedSinkBase],
      styleId: 330006,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330006, "Greek Villa"]]),
      unitPriceFor: () => 375.89,
    });

    expect(lines).toEqual([
      expect.objectContaining({
        masterCode: "SB-33",
        unitPrice: 375.89,
        placementUids: ["selected-sb-33"],
      }),
    ]);
  });

  it("keeps the exact Cinder Core Madison W-30-24 price identity aligned between 3D and cart/invoice lines", () => {
    const w3024 = {
      ...bec,
      uid: "placed-w-30-24",
      cabinetId: 9390138,
      masterCode: "W-30-24",
      description: '30" Double Door Wall Cabinet',
      category: "Wall",
      placement: "wall",
      width: 30,
      height: 24,
      depth: 12,
      styleId: 330022,
    } as PlacedCabinet;
    const exactHomeownerPrice = 298.49;
    const common = {
      placed: [w3024],
      styleId: 330022,
      distributorId: 210002,
      tier: "homeowner" as const,
      styleNameById: new Map([[330022, "Cinder Core (Madison)"]]),
      unitPriceFor: () => exactHomeownerPrice,
    };
    const cartLines = buildDesignCabinetCartLines(common);
    const previewLines = buildDesignPreviewPricingLines(common);

    expect(cartLines).toEqual([
      expect.objectContaining({
        masterCode: "W-30-24",
        styleId: 330022,
        styleLabel: "Cinder Core (Madison)",
        distributorId: 210002,
        tier: "homeowner",
        unitPrice: exactHomeownerPrice,
        priceLocked: true,
        qty: 1,
      }),
    ]);
    expect(previewLines).toEqual([
      expect.objectContaining({
        masterCode: "W-30-24",
        styleId: 330022,
        distributorId: 210002,
        tier: "homeowner",
        unitPrice: exactHomeownerPrice,
        placementUids: ["placed-w-30-24"],
      }),
    ]);
    expect(calculateCartSubtotal(cartLines)).toBe(calculateCartSubtotal(previewLines));
  });

  it("prices WDC2442 plus exactly one same-style PGWDC42 replacement door without inventing a WDC2442GD SKU", () => {
    const wdc2442 = {
      ...bec,
      uid: "hickory-wdc2442",
      cabinetId: 9390174,
      masterCode: "WDC2442",
      description: '24" Diagonal Corner Wall Cabinet with 3 Adjustable Shelves',
      category: "Wall",
      placement: "wall",
      width: 24,
      height: 42,
      depth: 24,
      numberOfDoors: 1,
      adjustableShelfCount: 3,
      styleId: 330007,
      glassDoor: true,
      glassDoorAddonCode: "PGWDC42",
    } as PlacedCabinet;
    const common = {
      placed: [wdc2442],
      styleId: 330007,
      distributorId: 210001,
      tier: "homeowner" as const,
      styleNameById: new Map([[330007, "Hickory Shaker"]]),
      unitPriceFor: () => 427.70,
      glassDoorAddonFor: () => ({
        masterCode: "PGWDC42",
        name: 'Hickory Shaker 42" Diagonal Glass Door',
        unitPrice: 212.17,
      }),
    };

    const cartLines = buildDesignCabinetCartLines(common);
    const previewLines = buildDesignPreviewPricingLines(common);

    expect(cartLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ masterCode: "WDC2442", unitPrice: 427.70, priceLocked: true, qty: 1 }),
      expect.objectContaining({ masterCode: "PGWDC42", unitPrice: 212.17, priceLocked: true, qty: 1 }),
    ]));
    expect(cartLines.map((line) => line.masterCode)).not.toContain("WDC2442GD");
    expect(previewLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ masterCode: "WDC2442", unitPrice: 427.70, placementUids: ["hickory-wdc2442"] }),
      expect.objectContaining({ masterCode: "PGWDC42", unitPrice: 212.17, placementUids: ["hickory-wdc2442"] }),
    ]));
    expect(calculateCartSubtotal(cartLines)).toBe(639.87);
    expect(calculateCartSubtotal(previewLines)).toBe(639.87);
  });

  it("aggregates one PGWDC42 replacement door per glass-selected WDC2442", () => {
    const first = {
      ...bec,
      uid: "first-glass-wdc",
      cabinetId: 9390174,
      masterCode: "WDC2442",
      description: "Diagonal Wall Corner",
      placement: "wall",
      styleId: 330007,
      glassDoor: true,
      glassDoorAddonCode: "PGWDC42",
    } as PlacedCabinet;
    const common = {
      placed: [first, { ...first, uid: "second-glass-wdc", x: 24 }],
      styleId: 330007,
      distributorId: 210001,
      tier: "homeowner",
      styleNameById: new Map([[330007, "Hickory Shaker"]]),
      unitPriceFor: () => 427.70,
      glassDoorAddonFor: () => ({ masterCode: "PGWDC42", name: "Diagonal Glass Door", unitPrice: 212.17 }),
    } as const;
    const lines = buildDesignCabinetCartLines(common);
    const previewLines = buildDesignPreviewPricingLines(common);

    expect(lines.find((line) => line.masterCode === "WDC2442")).toMatchObject({ qty: 2 });
    expect(lines.find((line) => line.masterCode === "PGWDC42")).toMatchObject({ qty: 2 });
    expect(previewLines.find((line) => line.masterCode === "WDC2442")).toMatchObject({ qty: 2, placementUids: ["first-glass-wdc", "second-glass-wdc"] });
    expect(previewLines.find((line) => line.masterCode === "PGWDC42")).toMatchObject({ qty: 2, placementUids: ["first-glass-wdc", "second-glass-wdc"] });
    expect(calculateCartSubtotal(lines)).toBe(1279.74);
    expect(calculateCartSubtotal(previewLines)).toBe(1279.74);
  });
});
