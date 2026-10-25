import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type DesignCabinet, type PlacedCabinet, wallPlacementAt } from "@/lib/design";
import { OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN, rangeCompanionProposal, repairLegacyWscMicrowaveBridges } from "./rangeCompanion";

function cabinet(overrides: Partial<DesignCabinet>): DesignCabinet {
  return {
    id: 1,
    masterCode: "WSC30",
    description: '30" x 6" Spice Cabinet',
    category: "Wall",
    subCategory: "Spice Cabinet",
    width: "30",
    height: "6",
    depth: "12",
    placement: "wall",
    numberOfDoors: 2,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    ...overrides,
  };
}

function range(): PlacedCabinet {
  return {
    uid: "range-1",
    cabinetId: 0,
    masterCode: "RANGE-30",
    description: '30" Range',
    placement: "appliance",
    x: 30,
    y: 0,
    width: 30,
    depth: 25,
    height: 36,
    rotation: 0,
    mountBottom: 0,
  };
}

const microwave = cabinet({
  id: 0,
  masterCode: "MW-30",
  description: 'Over-Range Microwave 30"',
  category: "Appliance",
  subCategory: "Appliance",
  width: "30",
  height: "16",
  depth: "15",
  placement: "appliance",
  numberOfDoors: 0,
  mountBottom: 56,
});

const wallBridge = (height: 12 | 15 | 18 | 21 | 24) => cabinet({
  id: height,
  masterCode: `W30${height}`,
  description: `30" × ${height}" Double Door Wall Cabinet`,
  subCategory: "Wall Cabinet",
  height: String(height),
});

describe("rangeCompanionProposal", () => {
  it("never uses WSC30, a spice cabinet, as the microwave bridge", () => {
    const proposal = rangeCompanionProposal(range(), DEFAULT_ROOM, [cabinet()], [microwave]);

    expect(proposal).toBeNull();
  });

  it("uses the selected-line 30-inch × 12-inch wall cabinet for a 30-inch upper run", () => {
    const proposal = rangeCompanionProposal(
      range(),
      DEFAULT_ROOM,
      [cabinet(), wallBridge(12), wallBridge(18), wallBridge(24)],
      [microwave],
      30,
    );

    expect(proposal?.bridge.masterCode).toBe("W3012");
    expect(proposal?.microwave.masterCode).toBe("MW-30");
    expect(proposal?.microwaveSpot.x).toBe(30);
    expect(proposal?.bridgeSpot.x).toBe(30);
	  expect(proposal?.microwaveMountBottom).toBe(56);
	  expect(proposal?.bridgeMountBottom).toBe(OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM_IN);
	  expect(proposal!.microwaveMountBottom + Number(proposal!.microwave.height)).toBe(72);
	  expect(proposal!.bridgeMountBottom + Number(proposal!.bridge.height)).toBe(84);
  });

  it("maps the upper cabinet heights to the only approved W30 microwave bridge codes", () => {
    const wallCabinets = [wallBridge(12), wallBridge(15), wallBridge(18), wallBridge(21), wallBridge(24)];

	  const expected = [
	    [30, "W3012", 84],
	    [33, "W3015", 87],
	    [36, "W3018", 90],
	    [39, "W3021", 93],
	    [42, "W3024", 96],
	  ] as const;

	  for (const [wallHeight, code, expectedTop] of expected) {
	    const proposal = rangeCompanionProposal(range(), DEFAULT_ROOM, wallCabinets, [microwave], wallHeight);
	    expect(proposal?.bridge.masterCode).toBe(code);
	    expect(proposal?.microwaveMountBottom).toBe(56);
	    expect(proposal?.bridgeMountBottom).toBe(72);
	    expect(proposal!.bridgeMountBottom + Number(proposal!.bridge.height)).toBe(expectedTop);
	  }
  });

  it("keeps a refrigerator, glass, or open-box wall cabinet out of a solid microwave bridge selection", () => {
    const proposal = rangeCompanionProposal(
      range(),
      DEFAULT_ROOM,
      [
        cabinet({ id: 10, masterCode: "W3012GD", description: '30" × 12" Glass Wall Cabinet', height: "12" }),
        cabinet({ id: 11, masterCode: "W301224", description: '30" × 12" Refrigerator Wall Cabinet', height: "12" }),
        cabinet({ id: 12, masterCode: "PWB-MOS-30-12", description: '30" × 12" Wall Microwave Open Box', height: "12" }),
        wallBridge(12),
      ],
      [microwave],
      30,
    );

    expect(proposal?.bridge.masterCode).toBe("W3012");
  });

	it("keeps the 16-inch microwave and its W3018 bridge fixed at the 72-inch datum", () => {
	  const proposal = rangeCompanionProposal(
	    range(),
	    DEFAULT_ROOM,
	    [wallBridge(18)],
	    [microwave],
	    36,
	  );

	  expect(proposal?.microwaveMountBottom).toBe(56);
	  expect(proposal?.bridgeMountBottom).toBe(72);
	  expect(proposal!.bridgeMountBottom).toBe(proposal!.microwaveMountBottom + 16);
	  expect(proposal!.bridgeMountBottom + Number(proposal!.bridge.height)).toBe(90);
  });

  it("does not offer a mismatched microwave width", () => {
    const proposal = rangeCompanionProposal(
      range(),
      DEFAULT_ROOM,
      [wallBridge(12)],
      [microwave, cabinet({ id: 3, masterCode: "MW-36", placement: "appliance", width: "36", height: "16", depth: "15", mountBottom: 60 })],
    );

    expect(proposal?.microwave.masterCode).toBe("MW-30");
  });

  it("uses the measured wall offset rather than screen x/y on a 45-degree layout", () => {
    const angledRoom = {
      ...DEFAULT_ROOM,
      width: 180,
      depth: 180,
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 60, y: 60 },
        { id: "v3", x: 60, y: 180 },
        { id: "v4", x: 0, y: 180 },
      ],
      customWalls: [
        { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
        { id: "straight", startVertexId: "v2", endVertexId: "v3" },
        { id: "return", startVertexId: "v3", endVertexId: "v4" },
        { id: "close", startVertexId: "v4", endVertexId: "v1" },
      ],
    };
    const spot = wallPlacementAt(15, 30, 25, "straight" as any, angledRoom);
    const angledRange: PlacedCabinet = { ...range(), ...spot, wallId: "straight", wallOffset: 15 };

    const proposal = rangeCompanionProposal(
      angledRange,
      angledRoom,
      [wallBridge(12)],
      [microwave],
    );

    expect(proposal?.bridgeSpot.wallId).toBe("straight");
    expect(proposal?.bridgeSpot.wallOffset).toBe(15);
    expect(proposal?.microwaveSpot.wallId).toBe("straight");
    expect(proposal?.microwaveSpot.wallOffset).toBe(15);
  });

  it("replaces only a centered legacy WSC30 microwave bridge with the permitted selected W3024 at 72 inches", () => {
    const placedMicrowave: PlacedCabinet = {
      ...range(),
      uid: "mw-1",
      masterCode: "MW-30",
      description: "Over-Range Microwave 30\"",
      placement: "appliance",
      depth: 15,
      height: 16,
      mountBottom: 56,
    };
    const legacySpiceBridge: PlacedCabinet = {
      ...range(),
      uid: "legacy-wsc",
      masterCode: "WSC30",
      description: "30 inch x 6 inch Spice Cabinet",
      category: "Wall",
      subCategory: "Spice Cabinet",
      placement: "wall",
      depth: 12,
      height: 6,
      mountBottom: 72,
    };
    const repaired = repairLegacyWscMicrowaveBridges(
      [range(), placedMicrowave, legacySpiceBridge],
      DEFAULT_ROOM,
      [wallBridge(24)],
      [microwave],
      42,
    );

    const bridge = repaired.placed.find((item) => item.uid === "legacy-wsc")!;
    expect(repaired.repairedUids).toEqual(["legacy-wsc"]);
    expect(bridge).toMatchObject({ masterCode: "W3024", mountBottom: 72, mountBottomAdjusted: true, overRangeMicrowaveBridge: true });
    expect(bridge.height).toBe(24);
    expect(bridge.x).toBe(30);
  });

  it("leaves an ordinary WSC30 spice stack untouched when it is not centered over a real microwave/range pair", () => {
    const spice = { ...range(), uid: "spice-only", masterCode: "WSC30", placement: "wall" as const, height: 6, depth: 12, x: 0, mountBottom: 54 };
    const original = [range(), spice];
    const repaired = repairLegacyWscMicrowaveBridges(original, DEFAULT_ROOM, [wallBridge(24)], [microwave], 42);
    expect(repaired.placed).toBe(original);
    expect(repaired.repairedUids).toEqual([]);
    expect(repaired.placed.find((item) => item.uid === "spice-only")?.masterCode).toBe("WSC30");
  });
});
