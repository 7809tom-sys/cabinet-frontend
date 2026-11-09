import { describe, expect, it } from "vitest";
import {
  microwaveBridgeHeightForNeighbor,
  normalizeStandardWallMounts,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  RANGE_BRIDGE_HEIGHTS_IN,
  preselectedRangeBridgeHeight,
  rangeBridgeHeightChoices,
  rangeCompanionDetail,
  rangeCompanionPlacement,
  rangeCompanionProposal,
  rangeCompanionSummary,
} from "./rangeCompanion";
import { overRangeBridgeFor, overRangeBridgeHeightFor } from "./overRangeCompanion";
import { buildDesignCabinetCartLines } from "./designCartLines";

const room: RoomData = { width: 168, depth: 120, ceilingHeight: 96 };

const wallRow = (width: number, height: number, id = width * 100 + height): DesignCabinet => ({
  id,
  masterCode: `W${width}${height}`,
  description: `${width}" x ${height}" x 12" Wall Cabinet - 2 Doors`,
  category: "Wall Cabinets",
  subCategory: "Wall",
  width: String(width),
  height: String(height),
  depth: "12",
  placement: "wall",
  numberOfDoors: 2,
  numberOfDrawers: 0,
} as DesignCabinet);

const catalog = (skip: number[] = []) => RANGE_BRIDGE_HEIGHTS_IN.filter((height) => !skip.includes(height)).map((height) => wallRow(30, height));
const microwaveRow = {
  id: 9001, masterCode: "MW-30", description: "Over-Range Microwave 30\"", category: "Appliance", subCategory: "Microwave",
  width: "30", height: "16", depth: "16", placement: "appliance", numberOfDoors: 0, numberOfDrawers: 0,
} as DesignCabinet;

const range: PlacedCabinet = {
  uid: "range", cabinetId: 1, masterCode: "RANGE-30", description: "30 inch Range", placement: "appliance",
  x: 48, y: 0, width: 30, depth: 26, height: 36, rotation: 0,
};
const neighbors = (height: number): PlacedCabinet[] => [
  { uid: "left", cabinetId: 2, masterCode: `W15${height}`, description: `15x${height} Wall Cabinet`, placement: "wall", x: 33, y: 0, width: 15, depth: 12, height, rotation: 0, mountBottom: 54 },
  { uid: "right", cabinetId: 3, masterCode: `W15${height}`, description: `15x${height} Wall Cabinet`, placement: "wall", x: 78, y: 0, width: 15, depth: 12, height, rotation: 0, mountBottom: 54 },
];
const proposalFor = (neighborHeight: number, wallCatalog = catalog(), options: { bridgeHeightIn?: number } = {}) =>
  rangeCompanionProposal(range, room, wallCatalog, [microwaveRow], 30, { placed: [range, ...neighbors(neighborHeight)], lineName: "Natura Maple", ...options });

describe("microwave bridge height choice (Tom, Nov 8)", () => {
  it("offers exactly 12/15/18/21/24 with the range-width SKU and the right top", () => {
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 30, wallCatalog: catalog(), ceilingIn: 96 });
    expect(choices.map((choice) => [choice.heightIn, choice.bridge?.masterCode, choice.topIn])).toEqual([
      [12, "W3012", 84], [15, "W3015", 87], [18, "W3018", 90], [21, "W3021", 93], [24, "W3024", 96],
    ]);
    for (const choice of choices) {
      const proposal = proposalFor(30, catalog(), { bridgeHeightIn: choice.heightIn })!;
      expect(proposal.bridgeHeightIn).toBe(choice.heightIn);
      expect(proposal.bridge!.masterCode).toBe(`W30${choice.heightIn}`);
      expect(proposal.bridgeMountBottom + Number(proposal.bridge!.height)).toBe(choice.topIn);
    }
  });

  it.each([
    [30, 12, "W3012", 84],
    [36, 18, "W3018", 90],
    [42, 24, "W3024", 96],
  ])("preselects for a %i-inch neighbour a %i-inch bridge (%s, top %i)", (neighborHeight, bridgeHeight, sku, top) => {
    expect(microwaveBridgeHeightForNeighbor(neighborHeight)).toBe(bridgeHeight);
    const proposal = proposalFor(neighborHeight)!;
    expect(proposal.bridgeHeightIn).toBe(bridgeHeight);
    expect(proposal.bridge!.masterCode).toBe(sku);
    expect(proposal.bridgeMountBottom).toBe(72);
    expect(proposal.bridgeMountBottom + Number(proposal.bridge!.height)).toBe(top);
    // Auto Design's build selector uses the same mapping.
    expect(overRangeBridgeHeightFor(neighborHeight, catalog())).toBe(bridgeHeight);
    expect(overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: neighborHeight, wallCatalog: catalog(), ceilingIn: 96 })?.masterCode).toBe(sku);
  });

  it("never defaults to 15 or 21 for those three neighbour heights, and otherwise takes the tallest under the line", () => {
    expect(proposalFor(42, catalog([24]))!.bridgeHeightIn).toBe(18);
    expect(proposalFor(36, catalog([18]))!.bridgeHeightIn).toBe(12);
    // A 33-inch neighbour tops at 87: the tallest of the five that does not pass it is 15.
    expect(proposalFor(33)!.bridgeHeightIn).toBe(15);
    // A frameless 30-1/4" upper is the 30" class.
    expect(microwaveBridgeHeightForNeighbor(30.25)).toBe(12);
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 30, wallCatalog: catalog(), ceilingIn: 96 });
    expect(preselectedRangeBridgeHeight(choices, 99, 39)).toBe(24);
  });

  it("disables a height the selected line does not sell, or one past the ceiling, and says why", () => {
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 30, wallCatalog: catalog([21]), ceilingIn: 96, lineName: "Natura Maple" });
    const missing = choices.find((choice) => choice.heightIn === 21)!;
    expect(missing.bridge).toBeNull();
    expect(missing.disabledReason).toBe("W3021 is not in the Natura Maple catalog.");
    const low = rangeBridgeHeightChoices({ rangeWidthIn: 30, wallCatalog: catalog(), ceilingIn: 90 });
    expect(low.filter((choice) => choice.bridge == null).map((choice) => choice.heightIn)).toEqual([21, 24]);
    expect(low.find((choice) => choice.heightIn === 24)?.disabledReason).toContain("past the 90″ ceiling");
    // A disabled height cannot be forced through the request.
    expect(proposalFor(30, catalog([21]), { bridgeHeightIn: 21 })!.bridge!.masterCode).toBe("W3012");
  });

  it("places, normalizes and bills exactly the chosen SKU", () => {
    const proposal = proposalFor(36, catalog(), { bridgeHeightIn: 15 })!;
    const bridge = rangeCompanionPlacement(proposal.bridge!, proposal.bridgeSpot, proposal.bridgeMountBottom, "bridge", 11);
    expect(bridge).toMatchObject({ cabinetId: 3015, masterCode: "W3015", height: 15, mountBottom: 72, overRangeMicrowaveBridge: true });
    const microwave = rangeCompanionPlacement(proposal.microwave, proposal.microwaveSpot, proposal.microwaveMountBottom, "mw", null);
    const plan = [range, ...neighbors(36), microwave, bridge];
    // The over-range rules keep the chosen bridge on the 72" datum.
    expect(normalizeStandardWallMounts(plan, [], room).find((item) => item.uid === "bridge")?.mountBottom).toBe(72);
    const lines = buildDesignCabinetCartLines({
      placed: [bridge, microwave], styleId: 11, distributorId: 4, tier: "homeowner",
      styleNameById: new Map([[11, "Natura Maple"]]), unitPriceFor: () => 120,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ masterCode: "W3015", qty: 1, unitPrice: 120 });
  });

  it("writes the dialog text for the chosen height instead of a fixed 72 to 84", () => {
    const proposal = proposalFor(42)!;
    expect(rangeCompanionSummary(proposal)).toBe("The 16″ MW-30 ends at the fixed 72″ bridge datum. The selected 24″ W3024 begins at 72″ and ends at 96″.");
    expect(rangeCompanionDetail(proposal)).toBe("The 16″ MW-30 runs from 56″ to 72″. The selected real W3024 begins at 72″ with no gap or trim and ends at 96″.");
  });
});
