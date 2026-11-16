import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import {
  OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";
import {
  framelessBridgeTopHeightIn,
  framelessWallTopDatumIn,
} from "@/lib/framelessWallTopAlignment";
import {
  microwaveBridgeHeightPick,
  overRangeBridgeFor,
  singleTopLineFor,
} from "@/lib/overRangeCompanion";
import { placeMandatoryOverRangeBridges } from "@/lib/overRangeFill";

const room: RoomData = { width: 168, depth: 120, ceilingHeight: 108 };

/** The frameless bridge family the book sells at 30": 12, 15-1/8, 17-5/8, 22-5/8, 30-1/4… */
function bridgeRow(height: number, nominal: number, id = nominal): DesignCabinet {
  return {
    id,
    masterCode: `W30${String(nominal).padStart(2, "0")}`,
    description: `30" x ${height}" x 13.5" Wall Cabinet`,
    category: "Wall Cabinets",
    subCategory: "Wall",
    width: "30",
    height: String(height),
    depth: "13.5",
    placement: "wall",
    numberOfDoors: 1,
    numberOfDrawers: 0,
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
  } as DesignCabinet;
}

const framedBridge = (height: number, id = height): DesignCabinet => ({
  id,
  masterCode: `W30${height}`,
  description: `30" x ${height}" Wall Cabinet`,
  category: "Wall Cabinets",
  subCategory: "Wall",
  width: "30",
  height: String(height),
  depth: "12",
  placement: "wall",
  numberOfDoors: 1,
  numberOfDrawers: 0,
} as DesignCabinet);

function range(offset = 48): PlacedCabinet {
  return {
    uid: "range",
    cabinetId: 1,
    masterCode: "RANGE-30",
    description: "30 inch Range",
    category: "Appliance",
    placement: "appliance",
    x: offset,
    y: 0,
    width: 30,
    depth: 25,
    height: 36,
    rotation: 0,
    wallId: "top",
    wallOffset: offset,
  };
}

// Tom (Nov 15 2026) retired the single 94-1/4" line: a frameless bridge meets
// the run's own top (54 + the run's class: 84-1/4 / 89-1/4 / 94-1/4).
describe("the frameless bridge tops out on the run's own top line", () => {
  it("measures 94-1/4 from the 54 inch bottom, and 22-1/4 from the 72 inch datum", () => {
    expect(framelessWallTopDatumIn()).toBe(94.25);
    expect(framelessBridgeTopHeightIn(OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM)).toBe(22.25);
    expect(OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM).toBe(72);
  });

  it("recognises the frameless line from a marker row, and from a 40-1/4 request", () => {
    expect(singleTopLineFor({ wallCatalog: [bridgeRow(22.63, 23)] })).toBe(84.25);
    expect(singleTopLineFor({ wallCatalog: [bridgeRow(22.63, 23)], wallCabinetHeightIn: 40 })).toBe(94.25);
    expect(singleTopLineFor({ wallCatalog: [framedBridge(18)], wallCabinetHeightIn: 40.25 })).toBe(94.25);
    expect(singleTopLineFor({ wallCatalog: [framedBridge(18)], wallCabinetHeightIn: 30 })).toBeNull();
  });

  it("picks the 12 inch box for a 30 inch frameless run and the 22-5/8 inch box for a 40 inch run", () => {
    const catalog = [bridgeRow(12, 12), bridgeRow(17.63, 18), bridgeRow(22.63, 23), bridgeRow(24, 24)];
    const thirty = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: catalog, ceilingIn: 108, topLineIn: singleTopLineFor({ wallCatalog: catalog, wallCabinetHeightIn: 30 }) });
    expect(thirty?.masterCode).toBe("W3012");
    const forty = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 40, wallCatalog: catalog, ceilingIn: 108, topLineIn: singleTopLineFor({ wallCatalog: catalog, wallCabinetHeightIn: 40 }) });
    expect(forty?.masterCode).toBe("W3023");
    expect(OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM + Number(forty!.height)).toBeCloseTo(94.63, 2);
  });

  it("never picks a box whose top passes the line", () => {
    // A 24" box tops at 96", past 94-1/4; the 22-5/8" box still wins.
    const catalog = [bridgeRow(22.63, 23), bridgeRow(24, 24)];
    const picked = microwaveBridgeHeightPick(
      [
        { heightIn: 23, topIn: 72 + 22.625 },
        { heightIn: 24, topIn: 72 + 24 },
      ],
      84.25,
      30,
      94.25,
    );
    expect(picked).toBe(23);
    expect(overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: catalog, ceilingIn: 108, topLineIn: 94.25 })?.masterCode).toBe("W3023");
  });

  it("takes the tallest the line sells when nothing reaches a 94-1/4 line, and says so", () => {
    const shortCatalog = [bridgeRow(12, 12), bridgeRow(17.63, 18)];
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 40, wallCatalog: shortCatalog, ceilingIn: 108, topLineIn: 94.25 });
    expect(bridge?.masterCode).toBe("W3018");
  });

  it("reports nothing when the bridge reaches the 30 inch run's line", () => {
    const catalog = [bridgeRow(12, 12), bridgeRow(22.63, 23)];
    const seated = placeMandatoryOverRangeBridges({
      placed: [range()],
      room,
      wallCatalog: catalog,
      wallCabinetHeightIn: 30,
      styleId: 9,
      makeUid: () => "bridge-1",
    });
    expect(seated.added).toBe(true);
    expect(seated.findings).toEqual([]);
    const bridge = seated.placed.find((item) => item.uid === "bridge-1")!;
    expect(bridge.mountBottom).toBe(72);
    expect(Number(bridge.mountBottom) + Number(bridge.height)).toBeCloseTo(84, 1);
  });

  it("leaves a framed line on its own neighbour mapping", () => {
    const catalog = [framedBridge(12), framedBridge(15), framedBridge(18), framedBridge(21), framedBridge(24)];
    // No top line passed: the 30" neighbour keeps the 12" bridge at 84".
    const bridge = overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 30, wallCatalog: catalog, ceilingIn: 96 });
    expect(bridge?.masterCode).toBe("W3012");
  });
});
