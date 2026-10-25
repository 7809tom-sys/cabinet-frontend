import { describe, expect, it } from "vitest";
import type { PlacedCabinet, RoomData } from "@/lib/design";
import { resolveRangeHoodPlacement } from "./designToolRangeHoodPlacement";

const room: RoomData = { width: 120, depth: 96, ceilingHeight: 96 };
const range: PlacedCabinet = {
  uid: "range-right",
  cabinetId: 0,
  masterCode: "RANGE-30",
  description: "30-inch range",
  placement: "appliance",
  x: 95,
  y: 36,
  width: 30,
  depth: 25,
  height: 36,
  rotation: 90,
  numberOfDoors: 0,
  numberOfDrawers: 0,
};

describe("range hood placement", () => {
  it("centers HOOD-30 on the actual saved range wall instead of the next empty base opening", () => {
    expect(resolveRangeHoodPlacement([range], room, "right", range.uid, { x: 0, y: 0 }, {
      masterCode: "HOOD-30",
      width: 30,
      depth: 18,
      mountBottom: 66,
    })).toMatchObject({
      ok: true,
      rangeUid: range.uid,
      spot: { x: 102, y: 36, rotation: 90, wallId: "right", wallOffset: 36 },
      mountBottom: 66,
    });
  });

  it("reports the actual requirement when no saved range exists", () => {
    expect(resolveRangeHoodPlacement([], room, "top", null, { x: 30, y: 0 }, {
      masterCode: "HOOD-30",
      width: 30,
      depth: 18,
      mountBottom: 66,
    })).toEqual({ ok: false, message: "HOOD-30 must be installed above a compatible saved range. Add or select a range first." });
  });
});
