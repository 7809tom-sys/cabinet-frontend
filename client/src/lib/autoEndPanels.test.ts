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

  it("treats live Luxe Classic LSA as frameless and leaves framed Madison alone", () => {
    expect(requiresAutoEndPanels({
      id: 540005,
      styleCode: "LSA",
      ourName: "Luxe Classic LSA",
      aliasName: "Luxe Classic LSA",
      doorStyle: "Slab",
      finish: "Luxe Classic",
      color: "LSA",
      woodSpecies: null,
      boxConstruction: "18mm plywood composite cabinet box; standard altaeuro frameless box",
      distributorName: "Frameless",
      isFrameless: null,
      frameless: null,
    })).toBe(true);
    expect(requiresAutoEndPanels({
      ourName: "Luxe Classic LSA",
      aliasName: "Luxe Classic LSA",
      color: "LSA",
      doorStyle: "Slab",
      distributorName: "Madison",
      boxConstruction: null,
    })).toBe(true);
    expect(requiresAutoEndPanels({
      styleCode: "ZSA",
      ourName: "Zenit Classic ZSA",
      color: "ZSA",
      distributorName: "Madison",
    })).toBe(true);
    expect(requiresAutoEndPanels({
      styleCode: "SC",
      ourName: "Shaker Cinder",
      doorStyle: "Shaker",
      finish: "Cinder Core (Madison)",
      color: "#5A5A5A",
      boxConstruction: "1/2-inch plywood box with UV-coated matching exterior",
      overlayType: "Full overlay",
      distributorName: "Madison",
    })).toBe(false);
    expect(requiresAutoEndPanels({
      styleCode: "SW",
      ourName: "Shaker White",
      doorStyle: "Shaker",
      color: "#F5F5F5",
      boxConstruction: "1/2-inch plywood box with UV-coated matching exterior",
      distributorName: "Madison",
    })).toBe(false);
  });
});
