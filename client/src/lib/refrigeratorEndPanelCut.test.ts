import { describe, expect, it } from "vitest";
import { buildSheetCsv } from "@/components/design/DesignActions";
import { existingCabinetSku } from "@/components/design/InteractiveRoom3D";
import { applyCartCheckoutPrefill, cartItemToCheckoutPrefill } from "@/lib/cartCheckoutPrefill";
import { buildDesignCabinetCartLines, buildDesignPreviewPricingLines, bundleCabinetPricingSignature } from "@/lib/designCartLines";
import { buildMaterialsListRows } from "@/lib/designMaterialsList";
import { CUSTOM_SIZE_FEE, DEFAULT_ROOM, customSizeFee, placedFootprint, type PlacedCabinet } from "@/lib/design";
import { applyRefrigeratorEndPanelFieldCuts, refrigeratorEndPanelCutDownNote } from "@/lib/refrigeratorEndPanelCut";

const room = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 };

function fridge(depth: number): PlacedCabinet {
  return {
    uid: "fridge",
    cabinetId: 0,
    masterCode: "FRIDGE-36",
    description: 'Refrigerator 36"',
    placement: "appliance",
    x: 24,
    y: 0,
    width: 36,
    depth,
    height: 70,
    rotation: 0,
    wallId: "top",
    wallOffset: 24,
  };
}

function panel(depth: number, role: "left-panel" | "right-panel" = "left-panel"): PlacedCabinet {
  const offset = role === "left-panel" ? 23.25 : 60.5;
  return {
    uid: role,
    cabinetId: 9601,
    masterCode: "REPV3096",
    description: "Refrigerator End Panel",
    placement: "tall",
    customProfile: "refrigerator-end-panel",
    subCategory: "Refrigerator End Panel",
    x: offset,
    y: 0,
    width: 0.75,
    depth,
    height: 96,
    rotation: 0,
    wallId: "top",
    wallOffset: offset,
    refrigeratorAssemblyId: "fridge",
    refrigeratorAssemblyRole: role,
  };
}

function priceLines(placed: PlacedCabinet[]) {
  const args = {
    placed,
    styleId: 1,
    distributorId: 9,
    tier: "homeowner" as const,
    styleNameById: new Map([[1, "White"]]),
    unitPriceFor: () => 100,
  };
  return {
    cart: buildDesignCabinetCartLines(args),
    preview: buildDesignPreviewPricingLines(args),
  };
}

describe("refrigerator end panel field cut", () => {
  it("shows a 30 inch panel cut to a 24 inch refrigerator and keeps the stock SKU on the master BOM", () => {
    const placed = applyRefrigeratorEndPanelFieldCuts([fridge(24), panel(30), panel(30, "right-panel")], room);
    const left = placed.find((item) => item.uid === "left-panel");
    const right = placed.find((item) => item.uid === "right-panel");
    expect(left).toMatchObject({
      masterCode: "REPV3096",
      cabinetId: 9601,
      depth: 24,
      nominalDepth: 24,
      refrigeratorPanelStockDepth: 30,
    });
    expect(right?.depth).toBe(24);
    expect(placedFootprint(left!).d).toBe(24);
    expect(existingCabinetSku(left!).depth).toBe(24);
    expect(customSizeFee(left!)).toBe(0);
    expect(CUSTOM_SIZE_FEE).toBe(100);
    expect(refrigeratorEndPanelCutDownNote(left!.refrigeratorPanelStockDepth, left!.depth)).toBe("30 inch panel cut down to 24");

    const { cart, preview } = priceLines(placed);
    const line = cart.find((item) => item.masterCode === "REPV3096");
    expect(line).toMatchObject({ masterCode: "REPV3096", qty: 2, unitPrice: 100, priceLocked: true, qtyNote: "30 inch panel cut down to 24" });
    expect(preview.find((item) => item.masterCode === "REPV3096")?.qtyNote).toBe("30 inch panel cut down to 24");
    expect(cart.find((item) => item.masterCode === "FRIDGE-36")).toBeUndefined();

    const materials = buildMaterialsListRows({
      buildRows: [{
        code: "REPV3096",
        description: "Refrigerator End Panel — 30 inch panel cut down to 24",
        widthIn: 0.75,
        heightIn: 96,
        depthIn: left!.depth,
        placement: "tall",
        qty: 2,
        unitPrice: 100,
        pricingUnitPrice: 100,
      }],
      pricingLines: cart,
    });
    const material = materials.find((row) => row.code === "REPV3096");
    expect(material).toMatchObject({ code: "REPV3096", qty: 2, unitPrice: 100 });
    expect(material?.dimensions).toContain('24"');
    expect(material?.notes).toContain("30 inch panel cut down to 24");

    const csv = buildSheetCsv({
      room,
      styleName: "White",
      tier: "Homeowner",
      total: 200,
      extraLines: [],
      buildRows: [{
        code: "REPV3096",
        description: "Refrigerator End Panel — 30 inch panel cut down to 24",
        widthIn: 0.75,
        heightIn: 96,
        depthIn: 24,
        placement: "tall",
        qty: 2,
        unitPrice: 100,
      }],
    });
    expect(csv).toContain("REPV3096");
    expect(csv).toContain("30 inch panel cut down to 24");
    expect(csv).toContain("100.00");

    const checkout = applyCartCheckoutPrefill({
      rawCode: "REPV3096",
      normalized: "REPV3096",
      qty: 2,
      cabinetId: 9601,
      masterCode: "REPV3096",
      description: "Refrigerator End Panel",
      matched: true,
      confidence: "exact",
    }, cartItemToCheckoutPrefill({
      masterCode: "REPV3096",
      name: "Refrigerator End Panel",
      styleId: 1,
      styleLabel: "White",
      distributorId: 9,
      tier: "homeowner",
      unitPrice: 100,
      priceLocked: true,
      qty: 2,
      qtyNote: line?.qtyNote,
    }, 100));
    expect(checkout.masterCode).toBe("REPV3096");
    expect(checkout.description).toBe("Refrigerator End Panel — 30 inch panel cut down to 24");
    expect(bundleCabinetPricingSignature(placed, 1)).toBe(bundleCabinetPricingSignature([fridge(24), panel(30), panel(30, "right-panel")], 1));
  });

  it("leaves a deeper refrigerator and its stock panel unchanged", () => {
    const original = [fridge(36), panel(30), panel(30, "right-panel")];
    const placed = applyRefrigeratorEndPanelFieldCuts(original, room);
    expect(placed).toBe(original);
    const panels = placed.filter((item) => item.refrigeratorAssemblyRole?.endsWith("panel"));
    expect(panels).toHaveLength(2);
    expect(panels.every((item) => item.masterCode === "REPV3096" && item.depth === 30 && item.refrigeratorPanelStockDepth == null)).toBe(true);
    expect(placedFootprint(placed[1]!).d).toBe(30);
    expect(existingCabinetSku(placed[1]!).depth).toBe(30);
    expect(customSizeFee(placed[1]!)).toBe(0);
    expect(refrigeratorEndPanelCutDownNote(30, 30)).toBeNull();
    expect(refrigeratorEndPanelCutDownNote(30, 36)).toBeNull();

    const { cart } = priceLines(placed);
    const line = cart.find((item) => item.masterCode === "REPV3096");
    expect(line).toMatchObject({ masterCode: "REPV3096", qty: 2, unitPrice: 100 });
    expect(line?.qtyNote).toBeUndefined();
  });

  it("uses the actual stock depth when the sheet is not a whole inch", () => {
    const placed = applyRefrigeratorEndPanelFieldCuts([fridge(24), { ...panel(29.875), masterCode: "TEP3096" }], room);
    const cutPanel = placed.find((item) => item.uid === "left-panel");
    expect(cutPanel).toMatchObject({ masterCode: "TEP3096", depth: 24, refrigeratorPanelStockDepth: 29.875 });
    expect(refrigeratorEndPanelCutDownNote(cutPanel?.refrigeratorPanelStockDepth, cutPanel?.depth)).toBe("29.875 inch panel cut down to 24");
    expect(customSizeFee(cutPanel!)).toBe(0);
  });
});
