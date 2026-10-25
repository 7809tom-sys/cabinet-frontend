import { describe, expect, it } from "vitest";
import type { DesignCabinet } from "@/lib/design";
import {
  findClosestPlanCabinet,
  placementForInterpretedCabinet,
  wallSideForInterpretedCabinet,
} from "@/lib/planImportMapper";

const catalog: DesignCabinet[] = [
  { id: 1, masterCode: "B-30", description: 'Base Cabinet 30"', category: "Base", subCategory: "Base", width: "30", height: "34.5", depth: "24", placement: "base", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: false },
  { id: 2, masterCode: "SB-33", description: 'Sink Base 33"', category: "Base", subCategory: "Sink Base", width: "33", height: "34.5", depth: "24", placement: "base", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: false },
  { id: 3, masterCode: "W-30", description: 'Wall Cabinet 30"', category: "Wall", subCategory: "Wall", width: "30", height: "30", depth: "12", placement: "wall", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: false },
  { id: 4, masterCode: "P-24", description: 'Pantry Cabinet 24"', category: "Tall", subCategory: "Tall", width: "24", height: "84", depth: "24", placement: "tall", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: false },
  { id: 0, masterCode: "RANGE-30", description: 'Range / Stove 30"', category: "Appliance", subCategory: null, width: "30", height: "36", depth: "25", placement: "appliance", numberOfDoors: null, numberOfDrawers: null, isCornerCabinet: false },
];

describe("plan image cabinet matching", () => {
  it("uses an upper-cabinet note and width to select a wall cabinet", () => {
    const match = findClosestPlanCabinet(
      { label: '30" upper', cabinetType: "wall cabinet", widthInches: 30, wall: "rear wall", confidence: 0.96 },
      catalog,
    );

    expect(match?.cabinet.masterCode).toBe("W-30");
    expect(match?.placement).toBe("wall");
    expect(match?.wall).toBe("top");
  });

  it("prioritizes a sink-base match over a similarly sized generic base cabinet", () => {
    const match = findClosestPlanCabinet(
      { label: "sink", cabinetType: "sink base", widthInches: 32, wall: "front", confidence: 0.91 },
      catalog,
    );

    expect(match?.cabinet.masterCode).toBe("SB-33");
    expect(match?.placement).toBe("base");
    expect(match?.wall).toBe("bottom");
  });

  it("maps common wall aliases and falls back to the back wall when a note is ambiguous", () => {
    expect(wallSideForInterpretedCabinet("left wall")).toBe("left");
    expect(wallSideForInterpretedCabinet("unknown")).toBe("top");
    expect(placementForInterpretedCabinet({ label: "pantry", cabinetType: "tall cabinet" })).toBe("tall");
  });

  it("matches an approved appliance note to the designer appliance catalog", () => {
    const match = findClosestPlanCabinet(
      { label: "stove", cabinetType: "appliance", widthInches: 30, wall: "back", confidence: 0.92 },
      catalog,
    );

    expect(match?.cabinet.masterCode).toBe("RANGE-30");
    expect(match?.placement).toBe("appliance");
  });
});
