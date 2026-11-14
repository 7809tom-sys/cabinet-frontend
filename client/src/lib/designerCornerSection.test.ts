import { describe, expect, it } from "vitest";
import {
  isDesignerCornerBase,
  isDesignerCornerWall,
  isDesignerCornerWallUpper,
  isDesignerTrueBlindCornerBase,
  isTrueBlindCornerCode,
} from "./designerCornerSection";

describe("isTrueBlindCornerCode", () => {
  it("recognizes BBC, WBC, BLB, BCB, and BLIND codes", () => {
    expect(isTrueBlindCornerCode("BBC36")).toBe(true);
    expect(isTrueBlindCornerCode("BBC-36")).toBe(true);
    expect(isTrueBlindCornerCode("WBC2742")).toBe(true);
    expect(isTrueBlindCornerCode("BBL42")).toBe(true);
    expect(isTrueBlindCornerCode("WBL30")).toBe(true);
    expect(isTrueBlindCornerCode("BLB42")).toBe(true);
    expect(isTrueBlindCornerCode("BCB42")).toBe(true);
    expect(isTrueBlindCornerCode("BC-BLIND-36")).toBe(true);
    expect(isTrueBlindCornerCode("LSB36")).toBe(false);
    expect(isTrueBlindCornerCode("DCB36")).toBe(false);
    expect(isTrueBlindCornerCode("BER36")).toBe(false);
    expect(isTrueBlindCornerCode("B36")).toBe(false);
    expect(isTrueBlindCornerCode("CB36")).toBe(false);
  });
});

describe("Corner Cabinets section classifiers", () => {
  it("puts lazy Susan, easy reach, and diagonal bases in Corner Base, not as true blinds", () => {
    const lazy = { masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base", placement: "base" as const, subCategory: "Corner Base", width: 36, height: 34.5, isCornerCabinet: true };
    const easy = { masterCode: "BER36", description: "Easy Reach Corner Base", placement: "base" as const, subCategory: "Easy Reach", width: 36, height: 34.5 };
    const diagonal = { masterCode: "DCB36", description: "Diagonal Corner Base", placement: "base" as const, subCategory: "Corner Base", width: 36, height: 34.5, isCornerCabinet: true };
    for (const cabinet of [lazy, easy, diagonal]) {
      expect(isDesignerCornerBase(cabinet)).toBe(true);
      expect(isDesignerTrueBlindCornerBase(cabinet)).toBe(false);
      expect(isDesignerCornerWall(cabinet)).toBe(true); // flag/code also match, but placement keeps it out of the wall upper pool
      expect(isDesignerCornerWallUpper({ ...cabinet, placement: "base" })).toBe(false);
    }
  });

  it("still treats a Corner Base item as a corner when its stored type is wrongly blind", () => {
    const mistagged = {
      masterCode: "LSB36",
      description: "36 inch Lazy Susan Corner Base",
      placement: "base" as const,
      subCategory: "Corner Base",
      width: 36,
      height: 34.5,
      isCornerCabinet: true,
      cornerType: "blind-corner",
    };
    expect(isDesignerCornerBase(mistagged)).toBe(true);
    expect(isTrueBlindCornerCode(mistagged.masterCode)).toBe(false);
    expect(isDesignerTrueBlindCornerBase(mistagged)).toBe(false);
  });

  it("recognizes a Corner Wall diagonal from the section, even without a drawing type", () => {
    const wall = {
      masterCode: "CW2436",
      description: "24 inch Corner Wall Cabinet",
      placement: "wall" as const,
      subCategory: "Corner Wall",
      width: 24,
      height: 36,
    };
    expect(isDesignerCornerWall(wall)).toBe(true);
    expect(isDesignerCornerWallUpper(wall)).toBe(true);
    expect(isTrueBlindCornerCode(wall.masterCode)).toBe(false);
  });

  it("keeps a BBC in Corner Base as a true blind, and a WBC out of the diagonal upper pool", () => {
    const bbc = { masterCode: "BBC36", description: "Blind Corner Base", placement: "base" as const, subCategory: "Blind Corner Base", width: 36, height: 34.5 };
    const wbc = { masterCode: "WBC36", description: "Blind Corner Wall", placement: "wall" as const, subCategory: "Corner Wall", width: 36, height: 36, isCornerCabinet: true };
    expect(isDesignerCornerBase(bbc)).toBe(true);
    expect(isDesignerTrueBlindCornerBase(bbc)).toBe(true);
    expect(isDesignerCornerWall(wbc)).toBe(true);
    expect(isDesignerCornerWallUpper(wbc)).toBe(false);
  });

  it("keeps angled wall ends, WD-* vanity walls, and BA-* end bases out of the Corner sections", () => {
    expect(isDesignerCornerWall({ masterCode: "WAC1230", description: "Angled Wall Cabinet", placement: "wall", subCategory: "Wall", width: 12, height: 30 })).toBe(false);
    expect(isDesignerCornerWall({ masterCode: "WD-2436", description: "Vanity diagonal wall", placement: "wall", subCategory: "Corner Wall", width: 24, height: 36, isCornerCabinet: true })).toBe(false);
    expect(isDesignerCornerBase({ masterCode: "BA-24", description: "Angled base end", placement: "base", subCategory: "Corner Base", width: 24, height: 34.5 })).toBe(false);
  });

  it("includes a Corner Base catalog row identified only by its section subcategory", () => {
    const sectionOnly = { masterCode: "CB36", description: "36 inch Corner Base", placement: "base" as const, subCategory: "Corner Base", width: 36, height: 34.5 };
    expect(isDesignerCornerBase(sectionOnly)).toBe(true);
    expect(isDesignerTrueBlindCornerBase(sectionOnly)).toBe(false);
  });

  it("never treats a plain B/SB/DB code as a Corner Base, even with the tab flag", () => {
    const plain = { masterCode: "B36", description: '36" Corner Base Cabinet', placement: "base" as const, subCategory: "Corner Base", width: 36, height: 34.5, isCornerCabinet: true, cornerType: "blind-corner" };
    expect(isDesignerCornerBase(plain)).toBe(false);
    expect(isDesignerTrueBlindCornerBase(plain)).toBe(false);
    expect(isTrueBlindCornerCode(plain.masterCode)).toBe(false);
  });
});
