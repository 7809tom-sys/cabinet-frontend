import { describe, expect, it } from "vitest";
import {
  ASPEN_CHARCOAL_STAIN,
  RAISED_PANEL_BEVEL_DEPTH_IN,
  RAISED_PANEL_BEVEL_WIDTH_IN,
  isAspenCharcoal,
  isSkylineAspenRaised,
  resolveDoorProfile,
} from "./doorStyleAppearance";

const aspenCharcoal = {
  ourName: "Aspen Charcoal",
  aliasName: "Carbon Frost",
  styleCode: "AC",
  distributorName: "Skyline Cabinetry",
  distributorCode: "SK",
  doorStyle: "Raised Panel",
  doorPanelType: "Raised Panel",
  panelConstruction: "raised" as const,
  color: "Espresso Brown",
  finish: "Matching",
  woodSpecies: "Solid Birch",
  railWidth: "3.00",
  stileWidth: "3.00",
  bevelWidth: null,
  bevelDepth: null,
  insideEdgeProfile: null,
  drawerFrontType: "five-piece-raised" as const,
  grainDirection: "none" as const,
  finishSheen: "satin" as const,
};

describe("Skyline Aspen door mapping", () => {
  it("treats Aspen Charcoal and Aspen White as the Skyline raised-panel family", () => {
    expect(isSkylineAspenRaised(aspenCharcoal)).toBe(true);
    expect(isAspenCharcoal(aspenCharcoal)).toBe(true);
    expect(isSkylineAspenRaised({
      ourName: "Aspen White",
      styleCode: "AW",
      distributorName: "Preston",
      distributorCode: "SK",
      doorStyle: "Shaker",
      panelConstruction: "raised",
    })).toBe(true);
    expect(isSkylineAspenRaised({
      ourName: "Shaker Gray",
      styleCode: "GR",
      distributorName: "Preston",
      distributorCode: "SK",
      doorStyle: "Shaker",
    })).toBe(false);
  });

  it("gives AC a square raised panel, ogee edge, and visible bevel when the catalog omitted them", () => {
    const profile = resolveDoorProfile(aspenCharcoal);
    expect(profile).toMatchObject({
      doorStyle: "Raised Panel",
      doorPanelType: "Raised Panel",
      panelConstruction: "raised",
      insideEdgeProfile: "ogee",
      drawerFrontType: "five-piece-raised",
      grainDirection: "vertical-stiles-horizontal-rails",
      bevelWidth: RAISED_PANEL_BEVEL_WIDTH_IN,
      bevelDepth: RAISED_PANEL_BEVEL_DEPTH_IN,
      railWidth: 3,
      stileWidth: 3,
      finishSheen: "satin",
    });
    expect(profile.bevelDepth).toBeGreaterThan(0.18);
  });

  it("promotes Aspen White off the Shaker label onto the same raised panel", () => {
    const profile = resolveDoorProfile({
      ourName: "Aspen White",
      styleCode: "AW",
      distributorName: "Preston",
      distributorCode: "SK",
      doorStyle: "Shaker",
      panelConstruction: "raised",
      color: "White",
      railWidth: "3",
      stileWidth: "3",
      grainDirection: "none",
      finishSheen: "satin",
    });
    expect(profile.doorStyle).toBe("Raised Panel");
    expect(profile.panelConstruction).toBe("raised");
    expect(profile.insideEdgeProfile).toBe("ogee");
    expect(profile.bevelWidth).toBe(RAISED_PANEL_BEVEL_WIDTH_IN);
    expect(profile.grainDirection).toBe("none");
  });

  it("leaves an ordinary shaker and an explicit bevel alone", () => {
    const shaker = resolveDoorProfile({
      ourName: "Summit White Shaker",
      doorStyle: "Shaker",
      panelConstruction: "flat",
      railWidth: "3",
      stileWidth: "3",
      finishSheen: "satin",
    });
    expect(shaker.panelConstruction).toBe("flat");
    expect(shaker.doorStyle).toBe("Shaker");
    expect(shaker.bevelWidth).toBeNull();

    const measured = resolveDoorProfile({
      ...aspenCharcoal,
      bevelWidth: 0.5,
      bevelDepth: 0.18,
      insideEdgeProfile: "bevel",
    });
    expect(measured.bevelWidth).toBe(0.5);
    expect(measured.bevelDepth).toBe(0.18);
    expect(measured.insideEdgeProfile).toBe("bevel");
  });

  it("reads a nested audit profile the way the renderer receives it", () => {
    const profile = resolveDoorProfile({
      name: "Aspen Charcoal",
      code: "AC",
      distributorName: "Skyline Cabinetry",
      color: "Espresso Brown",
      doorProfile: {
        doorStyle: "Raised Panel",
        panelConstruction: "raised",
        railWidth: "3.00",
        stileWidth: "3.00",
        grainDirection: "none",
        finishSheen: "satin",
        drawerFrontType: "five-piece-raised",
      },
    });
    expect(profile.panelConstruction).toBe("raised");
    expect(profile.insideEdgeProfile).toBe("ogee");
    expect(profile.bevelDepth).toBe(RAISED_PANEL_BEVEL_DEPTH_IN);
    expect(ASPEN_CHARCOAL_STAIN).toMatch(/^#[0-9a-f]{6}$/);
  });
});
