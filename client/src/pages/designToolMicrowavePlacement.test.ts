import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type PlacedCabinet } from "@/lib/design";
import { resolveOverRangeMicrowavePlacement } from "./designToolMicrowavePlacement";

function range(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "range",
    cabinetId: 1,
    masterCode: "RANGE-30",
    description: "30 inch range",
    placement: "appliance",
    x: 42,
    y: 0,
    width: 30,
    depth: 25,
    height: 34.5,
    rotation: 0,
    ...overrides,
  } as PlacedCabinet;
}

describe("DesignTool MW-30 palette and drag attachment", () => {
  const microwave = { width: 30, depth: 15 };

	  it("anchors palette and drag targets over the selected top-wall range at the fixed 56-to-72-inch microwave datum", () => {
    const topRange = range({ uid: "top-range" });
    const palette = resolveOverRangeMicrowavePlacement([topRange], DEFAULT_ROOM, "top", "top-range", { x: 72, y: 72 }, microwave);
    const drag = resolveOverRangeMicrowavePlacement([topRange], DEFAULT_ROOM, "top", null, { x: 72, y: 72 }, microwave);
	    expect(palette).toMatchObject({ ok: true, rangeUid: "top-range", spot: { x: 42, y: 0, rotation: 0 }, mountBottom: 56 });
	    expect(drag).toMatchObject({ ok: true, rangeUid: "top-range", spot: { x: 42, y: 0, rotation: 0 }, mountBottom: 56 });
  });

  it("rejects palette and drag adds when no compatible range exists", () => {
    const result = resolveOverRangeMicrowavePlacement([], DEFAULT_ROOM, "top", null, { x: 72, y: 72 }, microwave);
    expect(result).toEqual({ ok: false, message: "MW-30 must be installed above a compatible range. Add or select a range first." });
  });
});
