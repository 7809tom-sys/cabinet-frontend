/**
 * Owner rule (Tom, Nov 13 2026): "counter top never go through a panel."
 * The dishwasher panel (DWP) - about 3 inches on the exposed side of the
 * dishwasher - is the one the counter sits on top of. A larger panel stops the
 * slab at its face.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type RoomData } from "./design";
import { DISHWASHER_PANEL_MAX_WIDTH_IN, isCountertopBearingPanel, reviewCountertopPanelClashes } from "./countertopPanelRule";

const ROOM = { ...DEFAULT_ROOM, width: 200 } as RoomData;

function base(uid: string, code: string, width: number, offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "bottom", ROOM);
  return {
    uid, cabinetId: 1, masterCode: code, description: code, category: "Base", subCategory: "Base",
    placement: "base", ...spot, width, depth: 24, height: 34.5, numberOfDoors: 1, numberOfDrawers: 0,
  } as PlacedCabinet;
}

function panel(uid: string, code: string, width: number, offset: number, height: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 0.75, "bottom", ROOM);
  return {
    uid, cabinetId: 1, masterCode: code, description: `${code} panel`, category: "Panel", subCategory: "Panel",
    placement: "base", ...spot, width, depth: 0.75, height, numberOfDoors: 0, numberOfDrawers: 0,
  } as PlacedCabinet;
}

describe("countertop vs panel", () => {
  it("treats a 3 inch dishwasher panel as the one a counter sits on", () => {
    const dwp = panel("dwp", "DWP24", 3, 36, 34.5);
    expect(isCountertopBearingPanel(dwp, ROOM)).toBe(true);
    expect(DISHWASHER_PANEL_MAX_WIDTH_IN).toBeGreaterThanOrEqual(3);
  });

  it("does not treat a wider panel as counter-bearing", () => {
    const end = panel("end", "BEP24", 24, 36, 34.5);
    expect(isCountertopBearingPanel(end, ROOM)).toBe(false);
  });

  it("reports a slab that covers a larger panel", () => {
    // The panel sits inside the base run's footprint, so a slab built for the run
    // overlaps it - exactly the "counter through a panel" case.
    const cabinet = base("b1", "B36", 36, 0);
    const end = panel("end", "BEP24", 24, 6, 34.5);
    const findings = reviewCountertopPanelClashes({ placed: [cabinet, end], room: ROOM });
    expect(findings.some((finding) => finding.code === "countertop-through-panel")).toBe(true);
  });
});
