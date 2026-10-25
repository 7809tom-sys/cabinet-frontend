import { describe, expect, it } from "vitest";
import {
  convertLegacyCooktopPlacements,
  countertopArea,
  isBaseHeightAppliance,
  removeOverlappingPlacements,
  type DesignCabinet,
  type PlacedCabinet,
} from "./design";
import { islandCountertopVisibleRects, islandRaisedBarRects, islandFacePlacement } from "./islandScene";
import { existingCabinetSku, threeDSceneInputDiagnostics } from "@/components/design/InteractiveRoom3D";

const base = (overrides: Partial<PlacedCabinet> = {}) => ({
  uid: "sb-36",
  cabinetId: 36,
  masterCode: "SB36",
  description: "36 inch sink base",
  category: "Base",
  subCategory: "Sink Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 36,
  depth: 24,
  height: 34.5,
  sinkTopType: "gas",
  sinkTopProductId: 902,
  rangeTopImageUrl: "/gas.jpg",
  ...overrides,
}) as PlacedCabinet;

const standardBase = ({ width = 36 } = {}) => ({
  id: 101,
  masterCode: `B${width}`,
  description: `${width} inch standard base`,
  category: "Base",
  subCategory: "Base Cabinet",
  placement: "base",
  width,
  depth: 24,
  height: 34.5,
}) as unknown as DesignCabinet;

describe("convertLegacyCooktopPlacements", () => {
  it("preserves an owned cooktop over its exact supporting base, but not a mismatched bay", () => {
    const converted = convertLegacyCooktopPlacements([base({ sinkTopType: "gas" })], [standardBase()]);
    const cooktop = converted.placed.find((item) => item.applianceRole === "countertop-opening")!;
    expect(removeOverlappingPlacements(converted.placed).placed.map((item) => item.uid)).toEqual([
      "sb-36",
      "sb-36:cooktop",
    ]);
    expect(removeOverlappingPlacements([
      converted.placed[0]!,
      { ...cooktop, x: 12 },
    ]).placed.map((item) => item.uid)).toEqual(["sb-36"]);
  });

  it("keeps the applied cooktop in the plan, elevation, and 3D placement contract", () => {
    const converted = convertLegacyCooktopPlacements([base({ sinkTopType: "gas" })], [standardBase()]);
    const cooktop = converted.placed.find((item) => item.applianceRole === "countertop-opening");
    expect(cooktop).toBeTruthy();
    expect(cooktop).toMatchObject({
      placement: "appliance",
      applianceCatalogCode: "CATALOG-APPLIANCE-902",
      width: 36,
      depth: 24,
      mountBottom: 34.5,
    });
    // PlanCanvas and ElevationView consume this placement array directly.
    expect(converted.placed.some((item) => item.uid === cooktop!.uid)).toBe(true);
    const scene = threeDSceneInputDiagnostics(converted.placed, null, null);
    expect(scene.mapped.some((item) => item.placementUid === cooktop!.uid)).toBe(true);
    expect(existingCabinetSku(cooktop!).applianceRole).toBe("countertop-opening");
  });

  it("keeps the exact SB cabinet and adds only an opening appliance", () => {
    for (const type of ["gas", "electric", "induction", "smooth-top"] as const) {
      const original = base({ sinkTopType: type, masterCode: "SB36", description: "36 inch sink base", x: 7, y: 11, rotation: 90, width: 36 });
      const result = convertLegacyCooktopPlacements([original], [standardBase()]);
      expect(result.convertedCabinetUids.has("sb-36")).toBe(true);
      expect(result.placed).toHaveLength(2);
      expect(result.placed[0]).toMatchObject({
        placement: "base",
        masterCode: "SB36",
        description: "36 inch sink base",
        x: 7,
        y: 11,
        rotation: 90,
        width: 36,
        sinkTopType: null,
      });
      expect(result.placed[1]).toMatchObject({
        placement: "appliance",
        applianceRole: "countertop-opening",
        applianceProductId: 902,
        applianceCatalogCode: "CATALOG-APPLIANCE-902",
        description: type === "smooth-top" ? "Smooth-top cooktop" : `${type[0].toUpperCase()}${type.slice(1)} cooktop`,
      });
    }
  });

  it("is idempotent and does not create a second appliance", () => {
    const once = convertLegacyCooktopPlacements([base()], [standardBase()]);
    const twice = convertLegacyCooktopPlacements(once.placed, [standardBase()]);
    expect(twice.placed).toEqual(once.placed);
    expect(twice.convertedCabinetUids.size).toBe(0);
  });

  it("does not require a matching standard base for a legacy SB cooktop", () => {
    const result = convertLegacyCooktopPlacements([base({ width: 33 })], []);
    expect(result.placed).toHaveLength(2);
    expect(result.placed[0]).toMatchObject({ masterCode: "SB36", width: 33, placement: "base" });
    expect(result.placed[1]).toMatchObject({ placement: "appliance", applianceRole: "countertop-opening", width: 33 });
    expect(result.convertedCabinetUids.size).toBe(1);
  });

  it("classifies plural catalog appliance categories at the base elevation", () => {
    expect(isBaseHeightAppliance({ placement: "appliance", category: "Appliances", subCategory: "Dishwasher", height: 34.5, mountBottom: 0 })).toBe(true);
    expect(isBaseHeightAppliance({ placement: "appliance", category: "Appliances", subCategory: "Refrigerator", height: 70, mountBottom: 0 })).toBe(false);
    expect(isBaseHeightAppliance({ placement: "appliance", category: "Appliances", subCategory: "Cooktop", height: 3, mountBottom: 34.5, applianceRole: "countertop-opening" })).toBe(false);
  });

  it("measures a dishwasher as part of a continuous B24 + DW + B24 wall run", () => {
    const left = base({ uid: "left", masterCode: "B24", width: 24, sinkTopType: null, sinkTopProductId: null });
    const dishwasher = base({
      uid: "dw", cabinetId: 700, masterCode: "DW24", description: "24 inch dishwasher", category: "Appliances",
      subCategory: "Dishwasher", placement: "appliance", width: 24, height: 34.5, sinkTopType: null,
      sinkTopProductId: null, applianceRole: "base-height",
    });
    const right = base({ uid: "right", width: 24, x: 48, sinkTopType: null, sinkTopProductId: null });
    const measurement = countertopArea([left, dishwasher, right]);
    expect(measurement.runInches).toBe(72);
    expect(measurement.squareFeet).toBe(12.8);
  });

  it("reports numeric island worktop and raised-bar areas around a cooktop opening", () => {
    const island = { x: 36, y: 36, width: 72, depth: 48, activeFace: "front" as const, raisedBar: true, raisedBarSide: "back" as const, raisedBarOverhang: 15 as const, countertopWidth: 75, countertopDepth: 27, countertopOffsetX: 1.5 };
    const left = islandFacePlacement(base({ uid: "island-left", width: 24 }), island, "front", 0);
    const cooktop = islandFacePlacement(base({ uid: "island-cooktop", cabinetId: 901, masterCode: "RANGE30", description: "30 inch gas cooktop", placement: "appliance", width: 30, applianceRole: "countertop-opening", sinkTopType: null, sinkTopProductId: null }), island, "front", 24);
    const right = islandFacePlacement(base({ uid: "island-right", width: 24 }), island, "front", 54);
    const placed = [left, cooktop, right];
    const worktopArea = islandCountertopVisibleRects(island, placed).reduce((sum, rect) => sum + rect.width * rect.depth, 0);
    const barArea = islandRaisedBarRects(island, placed).reduce((sum, rect) => sum + rect.width * rect.depth, 0);
    expect(worktopArea).toBe(1305);
    expect(islandRaisedBarRects(island, placed)).toHaveLength(1);
    expect(barArea).toBe(1462.5);
  });
});
