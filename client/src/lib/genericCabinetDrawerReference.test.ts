import { describe, expect, it } from "vitest";
import { resolveDoorDrawerCounts } from "@/lib/cabinetGraphics";
import {
  isStandardDoorBase,
  standardBaseDoorCount,
  standardBaseDoorSaveError,
  standardBaseFaceReference,
  standardBaseRenderedCounts,
} from "@/lib/genericCabinetDrawerReference";

describe("standard base door and drawer reference", () => {
  it("gives B12, B15, B18, and B21 one door and one full-width drawer", () => {
    expect(standardBaseDoorCount("B09")).toBe(1);
    expect(standardBaseFaceReference("B09")?.drawerRows).toEqual([]);
    expect(resolveDoorDrawerCounts({ masterCode: "B09", numberOfDoors: 2, numberOfDrawers: 2 })).toEqual({ doors: 1, drawers: 0 });
    for (const masterCode of ["B12", "B-15", "B18", "B-21", "B21-R"]) {
      expect(standardBaseDoorCount(masterCode)).toBe(1);
      expect(standardBaseFaceReference(masterCode)?.drawerRows).toEqual([{ count: 1 }]);
      expect(resolveDoorDrawerCounts({
        masterCode,
        width: 42,
        numberOfDoors: 2,
        numberOfDrawers: 2,
        description: "2 Door 2 Drawer Base",
      })).toEqual({ doors: 1, drawers: 1 });
    }
  });

  it("gives B24, B27, and B30 two doors and one full-width drawer", () => {
    for (const masterCode of ["B24", "B-27", "B30"]) {
      expect(standardBaseDoorCount({ masterCode, width: 18 })).toBe(2);
      expect(standardBaseFaceReference(masterCode)?.drawerRows).toEqual([{ count: 1 }]);
      expect(resolveDoorDrawerCounts({
        masterCode,
        description: "1 or 2 Drawers by distributor",
        numberOfDoors: 1,
        numberOfDrawers: 2,
      })).toEqual({ doors: 2, drawers: 1 });
    }
  });

  it("gives B33 through B42 two doors and one row of two drawers", () => {
    for (const masterCode of ["B33", "B36", "B-39", "B42"]) {
      const face = standardBaseFaceReference(masterCode);
      expect(face?.doors).toBe(2);
      expect(face?.drawerRows).toEqual([{ count: 2 }]);
      expect(face?.genericImageUrl).toContain("b33_b42");
      expect(resolveDoorDrawerCounts({
        masterCode,
        numberOfDoors: 1,
        numberOfDrawers: 1,
        drawerLayout: null,
      })).toEqual({ doors: 2, drawers: 2 });
    }
  });

  it("lets a saved drawerLayout override the reference row without changing the door count", () => {
    expect(standardBaseRenderedCounts({
      masterCode: "B42",
      drawerLayout: JSON.stringify([{ count: 1 }]),
      doors: 1,
      drawers: 1,
    })).toEqual({ doors: 2, drawers: 1 });
    expect(standardBaseRenderedCounts({
      masterCode: "B30",
      drawerLayout: JSON.stringify([{ count: 2, height: 6 }]),
      doors: 2,
      drawers: 1,
    })).toEqual({ doors: 2, drawers: 2 });
    expect(standardBaseRenderedCounts({
      masterCode: "SB36",
      drawerLayout: null,
      doors: 2,
      drawers: 2,
    })).toEqual({ doors: 2, drawers: 2 });
  });

  it("does not treat sink, drawer, full-height, or wall codes as standard door bases", () => {
    for (const masterCode of ["SB36", "DB18", "2-DB24", "3-DB30", "B18FH", "B18FH2RS", "W1830", "BBC36"]) {
      expect(isStandardDoorBase(masterCode)).toBe(false);
      expect(standardBaseDoorCount(masterCode)).toBeNull();
    }
  });

  it("blocks saving two doors on a standard base of 21 inches or less", () => {
    expect(standardBaseDoorSaveError("B21", 2)).toMatch(/one door/i);
    expect(standardBaseDoorSaveError("B-18", 1)).toBeNull();
    expect(standardBaseDoorSaveError("B30", 2)).toBeNull();
    expect(standardBaseDoorSaveError("W2130", 2)).toBeNull();
  });
});
