import { describe, expect, it } from "vitest";
import {
  floorCapableMosaics,
  isMosaicCatalogItem,
  isMosaicFloorProduct,
  isSelectableDesignerFloorMosaic,
  mosaicFloorPatternDegrees,
  mosaicFloorPatternLabel,
  mosaicFloorPatternOrStraight,
  mosaicFloorUv,
  readUsableAsFloor,
} from "./mosaicFloorTile";

const mosaic = {
  category: "Tile & Mosaic",
  subCategory: "Mosaic",
  name: "Arctic Vail",
  sellPrice: 34,
  showInDesigner: true,
  isActive: true,
};

describe("Pelican mosaic floor tile flag", () => {
  it("treats a missing flag as wall backsplash only", () => {
    expect(readUsableAsFloor(null)).toBe(false);
    expect(readUsableAsFloor({})).toBe(false);
    expect(readUsableAsFloor({ usableAsFloor: false })).toBe(false);
    expect(readUsableAsFloor({ usableAsFloor: 0 })).toBe(false);
    expect(readUsableAsFloor({ usableAsFloor: "false" })).toBe(false);
    expect(readUsableAsFloor({ usableAsFloor: true })).toBe(true);
    expect(readUsableAsFloor({ usableAsFloor: 1 })).toBe(true);
  });

  it("shows the checkbox only for Mosaic in Tile & Mosaic", () => {
    expect(isMosaicCatalogItem(mosaic)).toBe(true);
    expect(isMosaicCatalogItem({ ...mosaic, subCategory: "Tile" })).toBe(false);
    expect(isMosaicCatalogItem({ category: "Flooring", subCategory: "Mosaic", name: "Look" })).toBe(false);
  });

  it("lets a checked mosaic into the floor list and keeps an unchecked mosaic out", () => {
    const rows = [
      { ...mosaic, id: 1, usableAsFloor: true },
      { ...mosaic, id: 2, name: "Moonstone Hex", usableAsFloor: false },
      { ...mosaic, id: 3, name: "No flag yet" },
      { ...mosaic, id: 4, name: "Field", subCategory: "Tile", usableAsFloor: true },
      { ...mosaic, id: 5, name: "Hidden", usableAsFloor: true, showInDesigner: false },
    ];
    expect(floorCapableMosaics(rows).map((row) => row.id)).toEqual([1]);
    expect(isSelectableDesignerFloorMosaic(rows[1]!)).toBe(false);
    expect(isMosaicFloorProduct({ category: "Flooring", subCategory: "Planks & Flooring", name: "Mosaic Look Plank" })).toBe(false);
  });
});

describe("mosaic floor pattern", () => {
  it("defaults an older design to Straight (90°)", () => {
    expect(mosaicFloorPatternOrStraight(undefined)).toBe("straight");
    expect(mosaicFloorPatternOrStraight(null)).toBe("straight");
    expect(mosaicFloorPatternOrStraight("brick")).toBe("straight");
    expect(mosaicFloorPatternLabel(null)).toBe("Straight (90°)");
    expect(mosaicFloorPatternDegrees(null)).toBe(0);
    expect(mosaicFloorPatternDegrees("diagonal")).toBe(45);
  });

  it("rotates the sheet 45° along the continuous pitch and leaves Straight square to the walls", () => {
    expect(mosaicFloorUv(12, 0, 12, 12, "straight")).toEqual({ u: 1, v: 0 });
    const diagonal = mosaicFloorUv(12, 0, 12, 12, "diagonal");
    expect(diagonal.u).toBeCloseTo(Math.SQRT1_2);
    expect(diagonal.v).toBeCloseTo(-Math.SQRT1_2);
    const step = 12 * Math.SQRT1_2;
    const next = mosaicFloorUv(step, step, 12, 12, "diagonal");
    expect(next.u).toBeCloseTo(1);
    expect(next.v).toBeCloseTo(0);
  });
});
