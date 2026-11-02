import { describe, expect, it } from "vitest";
import {
  EXPOSED_PANEL_THICKNESS_IN,
  exposedPanelFindings,
  exposedPanelRequirements,
  verifyExposedPanelThickness,
} from "./exposedPanelRule";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet } from "./design";

function at(width: number, start: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, "top", DEFAULT_ROOM);
  return {
    uid: `c-${start}`,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: `${width} inch base`,
    category: "Base",
    subCategory: "Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 1,
    ...extra,
  } as PlacedCabinet;
}

describe("rule 10: a 3/4 inch panel on every visible side", () => {
  it("uses 3/4 inch stock", () => {
    expect(EXPOSED_PANEL_THICKNESS_IN).toBe(0.75);
  });

  it("finishes both ends of a run with nothing beside them", () => {
    const cabinet = at(36, 40);
    const requirements = exposedPanelRequirements({ placed: [cabinet], room: DEFAULT_ROOM });
    expect(requirements.map((requirement) => requirement.side).sort()).toEqual(["end", "start"]);
    expect(requirements.every((requirement) => requirement.cabinetUid === cabinet.uid)).toBe(true);
  });

  it("does not finish a side covered by a same-depth cabinet", () => {
    const left = at(24, 0);
    const right = at(24, 24, { uid: "c-right" });
    const requirements = exposedPanelRequirements({ placed: [left, right], room: DEFAULT_ROOM });
    // The shared seam is covered; only the two outer ends are exposed.
    expect(requirements).toHaveLength(2);
    expect(requirements.map((requirement) => requirement.atIn).sort((a, b) => a - b)).toEqual([0, 48]);
  });

  it("does not stock a side twice when the build already added the panel", () => {
    const cabinet = at(24, 0);
    const panel = {
      ...at(0.75, 0, {
        uid: "panel-1",
        masterCode: "REPV2496",
        category: "Panel",
        subCategory: "End Panel",
        description: '24" x 96" Refrigerator End Panel',
        width: 0.75,
        depth: 24,
        autoPlacedForUid: cabinet.uid,
        autoPlacedSide: "start" as const,
        autoPlacedReason: "run end",
      }),
    } as PlacedCabinet;
    const requirements = exposedPanelRequirements({ placed: [cabinet, panel], room: DEFAULT_ROOM });
    expect(requirements.some((requirement) => requirement.cabinetUid === cabinet.uid && requirement.side === "start")).toBe(false);
  });

  it("names a side that could not be finished", () => {
    const requirements = exposedPanelRequirements({ placed: [at(24, 0)], room: DEFAULT_ROOM });
    const findings = exposedPanelFindings(requirements, new Set());
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.ruleId).toBe("exposed-panel-three-quarter");
    expect(findings[0]!.severity).toBe("warning");
  });

  it("accepts 3/4 panels and rejects other thicknesses", () => {
    const panel = (uid: string, width: number): PlacedCabinet => at(width, 0, {
      uid,
      masterCode: "REPV2496",
      category: "Panel",
      subCategory: "End Panel",
      description: '24" x 96" Refrigerator End Panel',
      width,
      autoPlacedReason: "run end",
    }) as PlacedCabinet;
    expect(verifyExposedPanelThickness([panel("good", 0.75)]).ok).toBe(true);
    const thin = verifyExposedPanelThickness([panel("thin", 0.5)]);
    expect(thin.ok).toBe(false);
    expect(thin.tooThin).toHaveLength(1);
    const thick = verifyExposedPanelThickness([panel("thick", 1.5)]);
    expect(thick.tooThick).toHaveLength(1);
  });
});
