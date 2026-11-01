import { describe, expect, it } from "vitest";
import {
  canHaveSkins,
  doorStyleNeedView,
  dropIneligibleSkins,
  finishedEndIsNeeded,
  isSkinProduct,
  skinsAreNeeded,
  SKIN_NEEDED_LOCKED_TOOLTIP,
} from "./canHaveSkins";

const hickoryFrameless = {
  woodSpecies: "Hickory",
  ourName: "Hickory Shaker",
  styleCode: "SSH",
  boxConstruction: "standard altaeuro frameless box",
  supplierBrandName: "US Cabinet Depot",
};

const hickoryFramed = {
  woodSpecies: "Hickory",
  ourName: "Hickory Shaker",
  styleCode: "HS",
  boxConstruction: "plywood face frame",
  distributorName: "Summit",
};

const mapleFrameless = {
  woodSpecies: "Maple",
  ourName: "White Shaker",
  styleCode: "SW",
  boxConstruction: "standard altaeuro frameless box",
  supplierBrandName: "US Cabinet Depot",
};

const forestRustFramed = {
  ourName: "Forest Rust",
  woodSpecies: "Hickory",
  styleCode: "RH",
  boxConstruction: "face frame",
};

describe("canHaveSkins", () => {
  it("is true only for hickory frameless", () => {
    expect(canHaveSkins(hickoryFrameless)).toBe(true);
    expect(canHaveSkins({ woodSpecies: "Hickory", styleCode: "SSH" })).toBe(true);
    expect(canHaveSkins({ ourName: "Rustic Hickory", boxConstruction: "frameless" })).toBe(true);
  });

  it("is false for hickory framed, non-hickory frameless, and every other style", () => {
    expect(canHaveSkins(hickoryFramed)).toBe(false);
    expect(canHaveSkins(mapleFrameless)).toBe(false);
    expect(canHaveSkins(forestRustFramed)).toBe(false);
    expect(canHaveSkins({ ourName: "Forest Rust", styleCode: "RH" })).toBe(false);
    expect(canHaveSkins({ ourName: "Silver Shaker", styleCode: "HS" })).toBe(false);
    expect(canHaveSkins({ woodSpecies: "Maple", boxConstruction: "face frame" })).toBe(false);
    expect(canHaveSkins(null)).toBe(false);
  });

  it("cannot be forced on", () => {
    expect(canHaveSkins({ ...hickoryFramed, skinNeeded: true })).toBe(false);
    expect(canHaveSkins({ ...mapleFrameless, skinNeeded: true })).toBe(false);
    expect(skinsAreNeeded({ ...mapleFrameless, skinNeeded: true })).toBe(false);
    expect(skinsAreNeeded({ ...hickoryFramed, skinNeeded: 1 })).toBe(false);
    expect(skinsAreNeeded({ ourName: "Forest Green", skinNeeded: true, boxConstruction: "frameless" })).toBe(false);
  });

  it("defaults hickory frameless to skins and lets the owner turn them off", () => {
    expect(skinsAreNeeded(hickoryFrameless)).toBe(true);
    expect(skinsAreNeeded({ ...hickoryFrameless, skinNeeded: null })).toBe(true);
    expect(skinsAreNeeded({ ...hickoryFrameless, skinNeeded: false })).toBe(false);
  });

  it("reads frameless construction from the cabinet when the style row is separate", () => {
    expect(canHaveSkins({
      style: { woodSpecies: "Hickory", ourName: "Hickory" },
      cabinet: { constructionMethod: "Frameless; AltaEuro printed geometry" },
    })).toBe(true);
  });
});

describe("finished end needed", () => {
  it("defaults to No on every style and stays freely set", () => {
    expect(finishedEndIsNeeded(hickoryFrameless)).toBe(false);
    expect(finishedEndIsNeeded(mapleFrameless)).toBe(false);
    expect(finishedEndIsNeeded({ ...hickoryFramed, finishedEndNeeded: true })).toBe(true);
    expect(finishedEndIsNeeded({ ...mapleFrameless, finishedEndNeeded: 1 })).toBe(true);
    expect(finishedEndIsNeeded({ finishedEndNeeded: null })).toBe(false);
  });
});

describe("door style need view", () => {
  it("locks Skin needed off except for hickory frameless", () => {
    expect(doorStyleNeedView(hickoryFrameless)).toMatchObject({
      skinNeeded: true,
      skinNeededDisabled: false,
      skinNeededTooltip: null,
      finishedEndNeeded: false,
    });
    expect(doorStyleNeedView({ ...hickoryFrameless, skinNeeded: false, finishedEndNeeded: true })).toMatchObject({
      skinNeeded: false,
      skinNeededDisabled: false,
      finishedEndNeeded: true,
    });
    for (const style of [hickoryFramed, mapleFrameless, { ...mapleFrameless, skinNeeded: true }]) {
      expect(doorStyleNeedView(style)).toMatchObject({
        skinNeeded: false,
        skinNeededDisabled: true,
        skinNeededTooltip: SKIN_NEEDED_LOCKED_TOOLTIP,
      });
    }
  });
});

describe("dropIneligibleSkins", () => {
  const skin = { masterCode: "HICKORY-SKIN-BASE", description: "Hickory finished end skin" };
  const wallSkin = { masterCode: "WSV-30", description: "Wall skin" };
  const cabinet = { masterCode: "B24", description: "Base 24" };
  const endPanel = { masterCode: "BEP2535", description: "Base end panel" };

  it("keeps skins on hickory frameless and drops them everywhere else", () => {
    expect(dropIneligibleSkins([cabinet, skin, endPanel], hickoryFrameless)).toEqual([cabinet, skin, endPanel]);
    expect(dropIneligibleSkins([cabinet, skin, wallSkin, endPanel], hickoryFramed)).toEqual([cabinet, endPanel]);
    expect(dropIneligibleSkins([cabinet, skin], { ...mapleFrameless, skinNeeded: true })).toEqual([cabinet]);
    expect(dropIneligibleSkins([cabinet, endPanel], mapleFrameless)).toEqual([cabinet, endPanel]);
  });

  it("recognizes skin products without treating finished end panels as skins", () => {
    expect(isSkinProduct(skin)).toBe(true);
    expect(isSkinProduct({ masterCode: "BSV", description: "Base skin" })).toBe(true);
    expect(isSkinProduct(endPanel)).toBe(false);
    expect(isSkinProduct({ masterCode: "B24", description: "panelized box" })).toBe(false);
  });
});
