import { describe, expect, it } from "vitest";
import { availableLs3612ShelfReplacementChoices, isUnpricedLs3612 } from "./ls3612Replacement";

describe("LS3612 shelf-corner replacement eligibility", () => {
  it("offers only ER36 and BER36 in a stable order when they are available", () => {
    const choices = availableLs3612ShelfReplacementChoices([
      { masterCode: "BER36", id: 2 },
      { masterCode: "LS3612", id: 1 },
      { masterCode: "ER42", id: 3 },
      { masterCode: "ER36", id: 4 },
    ]);
    expect(choices.map((choice) => choice.masterCode)).toEqual(["ER36", "BER36"]);
  });

  it("is eligible only for an unpriced LS3612 line", () => {
    expect(isUnpricedLs3612("LS3612", null)).toBe(true);
    expect(isUnpricedLs3612("LS3612", 499.99)).toBe(false);
    expect(isUnpricedLs3612("BER36", null)).toBe(false);
  });
});
