/**
 * NKBA planning checks that were missing entirely (Tom, Nov 13 2026: "learn in
 * the internet"). The landings already enforced - fridge 15, sink 24/18, cooking
 * 12/15, dishwasher 36 and 21 - are not retested here.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type RoomData } from "./design";
import {
  applianceNeedsLanding,
  countertopFrontageIn,
  landingBesideApplianceIn,
  prepAreaBesideSinkIn,
  reviewNkbaPlan,
} from "./nkbaLandingRules";

const ROOM = { ...DEFAULT_ROOM, width: 240 } as RoomData;

function base(uid: string, code: string, description: string, width: number, wall: "bottom" | "top", offset: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, wall, ROOM);
  return {
    uid, cabinetId: 1, masterCode: code, description, category: "Base", subCategory: "Base",
    placement: "base", ...spot, width, depth: 24, height: 34.5,
    numberOfDoors: 1, numberOfDrawers: 0, ...extra,
  } as PlacedCabinet;
}

function appliance(uid: string, code: string, description: string, width: number, offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "bottom", ROOM);
  return {
    uid, cabinetId: 1, masterCode: code, description, category: "Appliance", subCategory: null,
    placement: "appliance", ...spot, width, depth: 24, height: 34.5, numberOfDoors: 0, numberOfDrawers: 0,
  } as PlacedCabinet;
}

describe("NKBA planning checks", () => {
  it("counts usable frontage and leaves corner cabinets out", () => {
    const placed = [
      base("b1", "B24", '24" Base', 24, "bottom", 0),
      base("b2", "B24", '24" Base', 24, "bottom", 24),
      base("c1", "LS36", '36" Lazy Susan', 36, "bottom", 48),
    ];
    expect(countertopFrontageIn(placed, ROOM)).toBe(48);
  });

  it("flags a plan with no preparation run beside the sink", () => {
    const placed = [
      base("sink", "SB36", "Sink Base 36", 36, "bottom", 0, { numberOfDoors: 2 }),
      appliance("fridge", "FRIDGE-36", "36 inch refrigerator", 36, 36),
      appliance("mw", "MW-24", "microwave", 24, 72),
    ];
    const codes = reviewNkbaPlan({ placed, room: ROOM }).map((finding) => finding.code);
    expect(codes).toContain("prep-work-area-short");
    expect(codes).toContain("countertop-frontage-short");
  });

  it("measures the landing next to a microwave and names it when short", () => {
    const mw = appliance("mw", "MW-24", "microwave", 24, 100);
    const placed = [base("b1", "B18", '18" Base', 18, "bottom", 82), mw];
    expect(applianceNeedsLanding(mw)).toBe("microwave");
    expect(landingBesideApplianceIn(mw, placed, ROOM)).toBe(18);
    const findings = reviewNkbaPlan({ placed, room: ROOM });
    expect(findings.some((finding) => finding.code === "microwave-landing-short")).toBe(false);
  });

  it("keeps quiet about a kitchen that meets the rule", () => {
    const placed = [
      base("sink", "SB36", "Sink Base 36", 36, "bottom", 0),
      base("prep", "B36D", '36" Drawer Base', 36, "bottom", 36),
      base("b1", "B24", '24" Base', 24, "bottom", 72),
      base("b2", "B24", '24" Base', 24, "top", 0),
      base("b3", "B24", '24" Base', 24, "top", 24),
      base("b4", "B24", '24" Base', 24, "top", 48),
      base("b5", "B24", '24" Base', 24, "top", 72),
    ];
    const findings = reviewNkbaPlan({ placed, room: ROOM });
    expect(findings.some((finding) => finding.code === "prep-work-area-short")).toBe(false);
  });
});
