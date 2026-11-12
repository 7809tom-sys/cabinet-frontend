import { afterEach, describe, expect, it } from "vitest";
import {
  ANCHOR_ORDER,
  ANCHOR_WIGGLE_MAX_IN,
  anchorKindOf,
  anchorSlideAllowance,
  anchorWiggleMaxIn,
  anchorsWithinSlideLimit,
  pieceStaysInsideRefrigeratorLimit,
  refrigeratorLimitIn,
  seatedAnchors,
} from "./autoDesignAnchors";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet } from "./design";
import { resetKitchenRuleParameters, setKitchenRuleParameters } from "./kitchenRuleParameters";

function placedItem(
  masterCode: string,
  width: number,
  start: number,
  placement: "appliance" | "base" | "wall" | "tall",
  extra: Partial<PlacedCabinet> = {},
): PlacedCabinet {
  const depth = placement === "wall" ? 12 : placement === "appliance" ? 26 : 24;
  const spot = wallPlacementAt(start, width, depth, "bottom", DEFAULT_ROOM);
  return {
    uid: `${masterCode}-${start}`,
    cabinetId: 1,
    masterCode,
    description: masterCode,
    category: placement === "appliance" ? "Appliance" : "Base",
    subCategory: "Base",
    placement,
    ...spot,
    width,
    depth,
    height: placement === "wall" ? 30 : 34.5,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    ...extra,
  } as PlacedCabinet;
}

describe("rule 1: appliances are fixed anchors first", () => {
  it("seats range, sink, then refrigerator", () => {
    expect(ANCHOR_ORDER).toEqual(["range", "sink", "refrigerator"]);
    const range = placedItem("RANGE-30", 30, 60, "appliance");
    const sink = placedItem("SB36", 36, 10, "base");
    const fridge = placedItem("FRIDGE-36", 36, 100, "appliance");
    const anchors = seatedAnchors([fridge, sink, range], DEFAULT_ROOM);
    expect(anchors.map((anchor) => anchor.kind)).toEqual(["range", "sink", "refrigerator"]);
    expect(anchors.find((anchor) => anchor.kind === "refrigerator")!.capsRunPast).toBe(true);
  });

  it("classifies anchors and ignores ordinary cabinets", () => {
    expect(anchorKindOf(placedItem("RANGE-30", 30, 0, "appliance"))).toBe("range");
    expect(anchorKindOf(placedItem("FRIDGE-36", 36, 0, "appliance"))).toBe("refrigerator");
    expect(anchorKindOf(placedItem("SB36", 36, 0, "base"))).toBe("sink");
    expect(anchorKindOf(placedItem("B18", 18, 0, "base"))).toBeNull();
  });

  it("allows 3 inches of wiggle, and no more", () => {
    expect(ANCHOR_WIGGLE_MAX_IN).toBe(3);
    expect(anchorWiggleMaxIn()).toBe(3);
    expect(anchorSlideAllowance("range")).toBe(3);
    expect(anchorSlideAllowance("sink")).toBe(3);
    expect(anchorSlideAllowance("refrigerator")).toBe(3);
    // The unmeasured refrigerator bay gap-closing slide is a separate 6 inch rule.
    expect(anchorSlideAllowance("refrigerator", { measured: false })).toBe(6);
    const range = placedItem("RANGE-30", 30, 63, "appliance");
    expect(anchorsWithinSlideLimit({
      placed: [range],
      room: DEFAULT_ROOM,
      measuredCenters: { [range.uid]: 60 },
    })).toBe(true);
    const tooFar = placedItem("RANGE-30", 30, 64, "appliance");
    expect(anchorsWithinSlideLimit({
      placed: [tooFar],
      room: DEFAULT_ROOM,
      measuredCenters: { [tooFar.uid]: 60 },
    })).toBe(false);
  });

  afterEach(() => {
    resetKitchenRuleParameters();
  });

  it("reads the live admin cap so it cannot drift from the wiggle pass", () => {
    setKitchenRuleParameters({ anchor_wiggle_cap_in: 1.5 });
    expect(anchorWiggleMaxIn()).toBe(1.5);
    expect(anchorSlideAllowance("range")).toBe(1.5);
    expect(anchorSlideAllowance("refrigerator")).toBe(1.5);
    // The constant stays the code default; the live function follows the admin value.
    expect(ANCHOR_WIGGLE_MAX_IN).toBe(3);
  });

  it("reads the refrigerator panel limit and refuses anything past it", () => {
    const fridge = placedItem("FRIDGE-36", 36, 100, "appliance", { refrigeratorAssemblyId: "fridge-1" });
    const limit = refrigeratorLimitIn({ placed: [fridge], room: DEFAULT_ROOM, wallId: "bottom" });
    expect(limit).not.toBeNull();
    // A run that continues before the bay must stop at the bay's near face.
    expect(pieceStaysInsideRefrigeratorLimit({ startIn: 60, widthIn: 40, limit, side: "before" })).toBe(true);
    expect(pieceStaysInsideRefrigeratorLimit({ startIn: 60, widthIn: 42, limit, side: "before" })).toBe(false);
    // A run after the bay must start at or past the far face.
    expect(pieceStaysInsideRefrigeratorLimit({ startIn: 136, widthIn: 8, limit, side: "after" })).toBe(true);
    expect(pieceStaysInsideRefrigeratorLimit({ startIn: 130, widthIn: 8, limit, side: "after" })).toBe(false);
  });

  it("treats a slide of exactly 3 inches as legal and 3 1/8 as not", () => {
    const sink = placedItem("SB36", 36, 40, "base");
    expect(anchorsWithinSlideLimit({ placed: [sink], room: DEFAULT_ROOM, measuredCenters: { [sink.uid]: 43 } })).toBe(true);
    expect(anchorsWithinSlideLimit({ placed: [sink], room: DEFAULT_ROOM, measuredCenters: { [sink.uid]: 43.125 } })).toBe(false);
  });
});
