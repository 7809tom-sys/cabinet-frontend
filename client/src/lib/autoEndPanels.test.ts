import { describe, expect, it } from "vitest";
import { requiresAutoEndPanels } from "./autoEndPanels";

describe("requiresAutoEndPanels", () => {
  it("is true for frameless box construction, a frameless flag, and a frameless distributor line", () => {
    expect(requiresAutoEndPanels({ boxConstruction: "18mm plywood; standard altaeuro frameless box" })).toBe(true);
    expect(requiresAutoEndPanels({ isFrameless: true, boxConstruction: "plywood face frame" })).toBe(true);
    expect(requiresAutoEndPanels({ distributorName: "US Cabinet Depot", ourName: "White Shaker" })).toBe(true);
    expect(requiresAutoEndPanels({ styleCode: "TWP", ourName: "Milano" })).toBe(true);
    expect(requiresAutoEndPanels({ ourName: "Frameless Shaker", boxConstruction: "plywood" })).toBe(true);
  });

  it("is true for Hickory species, Hickory names, and Hickory skins", () => {
    expect(requiresAutoEndPanels({ woodSpecies: "Hickory", ourName: "Natural", boxConstruction: "face frame" })).toBe(true);
    expect(requiresAutoEndPanels({ ourName: "Rustic Hickory", woodSpecies: "Alder" })).toBe(true);
    expect(requiresAutoEndPanels({ name: "Hickory skin", doorStyle: "Shaker" })).toBe(true);
    expect(requiresAutoEndPanels({ aliasName: "Silver Hickory Skin" })).toBe(true);
  });

  it("is false for a framed line that is not Hickory", () => {
    expect(requiresAutoEndPanels(null)).toBe(false);
    expect(requiresAutoEndPanels({
      ourName: "White Shaker",
      woodSpecies: "Maple",
      boxConstruction: "1/2 in. plywood face frame",
      distributorName: "Summit",
      styleCode: "SW",
    })).toBe(false);
  });
});
