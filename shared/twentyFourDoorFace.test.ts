import { describe, expect, it } from "vitest";
import {
  correctTwentyFourSingleDoor,
  describeAsTwoDoor,
  isBookSingleDoorTwentyFourCode,
  isTwentyFourSingleDoorDataError,
  twoDoorShopperDescription,
} from "./twentyFourDoorFace";

describe("24 inch cabinets are drawn and described as two doors", () => {
  it("treats the book's trailing S as the single-door marker, including W2430S", () => {
    for (const code of ["B24S", "B24SFH", "SB24S", "SB24SFH", "VSB24S", "VSB24SFH", "W2430S"]) {
      expect(isBookSingleDoorTwentyFourCode(code)).toBe(true);
      expect(isTwentyFourSingleDoorDataError({ masterCode: code, width: 24, numberOfDoors: 1 })).toBe(true);
    }
    expect(isBookSingleDoorTwentyFourCode("W2430")).toBe(false);
    expect(isBookSingleDoorTwentyFourCode("B24")).toBe(false);
    expect(isBookSingleDoorTwentyFourCode("B30S")).toBe(false);
  });

  it("corrects a stored one-door count without renaming the SKU", () => {
    const row = {
      masterCode: "W2430S",
      description: '24" × 30" × 12" Wall Cabinet — 2 Doors, 2 Adjustable Shelves',
      width: "24.00",
      numberOfDoors: 1,
      graphicType: "wall_1door",
    };
    expect(correctTwentyFourSingleDoor(row, { doors: 1, drawers: 0 })).toEqual({ doors: 2, drawers: 0 });
    expect(row.masterCode).toBe("W2430S");
    expect(twoDoorShopperDescription({
      masterCode: "B24SFH",
      description: '24" W × 34.75" H × 24" D Full Height Single Door Base',
      width: 24,
    })).toBe('24" W × 34.75" H × 24" D Full Height Double Door Base');
    expect(describeAsTwoDoor("Single Door Single Drawer")).toBe("Double Door Single Drawer");
  });

  it("leaves 21 inch cabinets, corners, lifts, and drawer stacks as they are", () => {
    expect(isTwentyFourSingleDoorDataError({ masterCode: "W2130", width: 21, description: "Single Door Wall" })).toBe(false);
    expect(correctTwentyFourSingleDoor(
      { masterCode: "W2130", width: 21, description: "Single Door Wall" },
      { doors: 1, drawers: 0 },
    ).doors).toBe(1);
    for (const row of [
      { masterCode: "DCW2430", width: 24, description: "Diagonal Corner Wall Single Door Cabinet", cornerType: "diagonal" },
      { masterCode: "WFD2418-BLUM", width: 24, description: "Blum Aventos Flip-Up Door Wall Cabinet" },
      { masterCode: "AG2418", width: 24, description: "Single Door Appliance Garage Cabinet" },
      { masterCode: "2DB24", width: 24, description: "Two Drawer Base" },
      { masterCode: "BBC36", width: 36, description: "Blind Corner Base" },
      { masterCode: "DB30", width: 30, description: '30" Desk Base' },
      { masterCode: "VDDB42", width: 42, description: "Vanity Combo Base — 1 Center Door" },
    ]) {
      expect(isTwentyFourSingleDoorDataError(row), row.masterCode).toBe(false);
      expect(correctTwentyFourSingleDoor(row, { doors: 1, drawers: 0 }).doors).toBe(1);
    }
    expect(twoDoorShopperDescription({
      masterCode: "DCW2430",
      width: 24,
      description: '24" Diagonal Corner Wall Single Door Cabinet',
      cornerType: "diagonal",
    })).toMatch(/Single Door/);
  });

  it("corrects any other standard 24 inch cabinet that was stored as one door", () => {
    expect(correctTwentyFourSingleDoor(
      { masterCode: "W3030", width: 30, description: "Single Door Wall Cabinet" },
      { doors: 1, drawers: 0 },
    )).toEqual({ doors: 2, drawers: 0 });
    expect(correctTwentyFourSingleDoor(
      { masterCode: "W3030", width: 30, description: "Double Door Wall Cabinet" },
      { doors: 2, drawers: 0 },
    ).doors).toBe(2);
    expect(twoDoorShopperDescription({
      masterCode: "T2DB2494",
      width: 24,
      description: "Tall one door cabinet",
    })).toBe("Tall two doors cabinet");
  });
});
